import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateListing } from "@/lib/openai";
import {
  getOrCreateUser,
  getGeneration,
  updateGenerationListing,
} from "@/lib/supabase-helpers";
import { checkRateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/**
 * On-demand listing text for an already-generated try-on. Costs NO credits —
 * credits are charged only for the image in /api/generate. Idempotent: if the
 * generation already has a listing, it's returned without another GPT call.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  // Burst guard on its own window (separate from image generation) — stops
  // rapid-fire GPT calls without eating the image-generation rate budget.
  const rl = await checkRateLimit(`${userId}:listing`);
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Zu viele Anfragen, bitte kurz warten.", code: "RATE_LIMITED", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // ── Parse + validate body ───────────────────────────────────────────────────
  let generationId: string;
  let garmentImage: string;
  let listingLang: "de" | "en";
  try {
    const body = await request.json();
    generationId = body.generationId;
    garmentImage = body.garmentImage;
    listingLang = body.listingLang === "en" ? "en" : "de";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof generationId !== "string" || generationId.trim() === "") {
    return NextResponse.json({ error: "Missing generation id" }, { status: 400 });
  }
  if (typeof garmentImage !== "string" || garmentImage.trim() === "") {
    return NextResponse.json({ error: "No clothing photo provided" }, { status: 400 });
  }

  // ── Resolve user + verify ownership of the generation ───────────────────────
  let internalUserId: string;
  let record: Awaited<ReturnType<typeof getGeneration>>;
  try {
    const user = await getOrCreateUser(userId);
    internalUserId = user.id;
    record = await getGeneration(internalUserId, generationId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("[/api/generate/listing] lookup failed:", msg);
    return NextResponse.json({ error: "Database unavailable", code: "DB_ERROR" }, { status: 503 });
  }
  if (!record) {
    return NextResponse.json({ error: "Generation not found", code: "NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: already has a listing → return it, no GPT call, no cost.
  if (record.listing_description) {
    return NextResponse.json({
      listing: {
        title: record.listing_title ?? "",
        description: record.listing_description,
      },
    });
  }

  // ── Generate the listing + persist onto the SAME generation row ─────────────
  try {
    const listing = await generateListing(garmentImage, listingLang);
    try {
      await updateGenerationListing(
        internalUserId,
        generationId,
        listing.title,
        listing.description,
        listingLang
      );
    } catch (dbErr) {
      // Non-fatal: listing generated, DB update failed — still return the text.
      console.error("[/api/generate/listing] DB update failed (non-fatal):", dbErr);
    }
    return NextResponse.json({ listing });
  } catch (err) {
    console.error("[/api/generate/listing]", err);
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
