import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { auth, currentUser } from "@clerk/nextjs/server";
import { generateTryOn } from "@/lib/tryon";
import { generateListing } from "@/lib/openai";
import {
  getOrCreateUser,
  checkGenerationLimit,
  incrementGenerationCount,
  saveGeneration,
} from "@/lib/supabase-helpers";
import { checkRateLimit } from "@/lib/ratelimit";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // ── 1. Verify identity server-side ─────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to generate", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  // ── 1b. Burst rate limit: 5 req/min per user ────────────────────────────────
  //    Independent of the lifetime limit and the is_unlimited flag — this only
  //    guards against rapid-fire duplicate/buggy requests. Keyed by Clerk userId
  //    (per-account, not per-IP). Runs before the lifetime/unlimited checks.
  const rl = await checkRateLimit(userId);
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: "Zu viele Anfragen, bitte kurz warten.",
        code: "RATE_LIMITED",
        retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // ── 2. Resolve user record from Supabase ────────────────────────────────────
  //    Any error here returns JSON, never crashes the connection.
  let user: Awaited<ReturnType<typeof getOrCreateUser>>;
  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? null;
    user = await getOrCreateUser(userId, email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("[/api/generate] user lookup failed:", msg);
    return NextResponse.json(
      { error: `Database unavailable: ${msg}`, code: "DB_ERROR" },
      { status: 503 }
    );
  }

  // ── 3. Enforce demo limit: 3 generations total per user ────────────────────
  //    Server-side gate. Users flagged `is_unlimited` in the DB skip the limit
  //    (checkGenerationLimit returns allowed=true for them). This check lives
  //    here in the API route — the client cannot bypass it.
  const { allowed, used, limit, unlimited } = checkGenerationLimit(user);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `You've used all ${limit} free generations for this demo. Thanks for trying Resellr AI!`,
        code: "LIMIT_REACHED",
        used,
        limit,
      },
      { status: 403 }
    );
  }

  // ── 4. Parse and validate request body ─────────────────────────────────────
  let garmentImages: string[];
  let modelImage: string;
  let listingLang: "de" | "en";

  try {
    const body = await request.json();
    garmentImages = body.garmentImages;
    modelImage = body.modelImage;
    listingLang = body.listingLang === "en" ? "en" : "de";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(garmentImages) || garmentImages.length === 0) {
    return NextResponse.json({ error: "No clothing photo uploaded" }, { status: 400 });
  }
  if (typeof modelImage !== "string" || modelImage.trim() === "") {
    return NextResponse.json({ error: "No model selected" }, { status: 400 });
  }

  // ── 5. Resolve preset model to base64 ───────────────────────────────────────
  let resolvedModelImage: string;
  if (modelImage.startsWith("preset:")) {
    const modelId = modelImage.split(":")[1];
    const imagePath = path.join(process.cwd(), "public", "models", `${modelId}.jpg`);
    if (!fs.existsSync(imagePath)) {
      return NextResponse.json(
        { error: "Preset model not found. Please upload your own model photo." },
        { status: 400 }
      );
    }
    const buffer = fs.readFileSync(imagePath);
    resolvedModelImage = `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } else {
    resolvedModelImage = modelImage;
  }

  // ── 6. Run try-on + listing generation ─────────────────────────────────────
  try {
    const garmentImage = garmentImages[0];
    const [tryOnUrl, listing] = await Promise.all([
      generateTryOn(resolvedModelImage, garmentImage),
      generateListing(garmentImage, listingLang),
    ]);

    // ── 7. Persist to DB — errors here are logged but never surface to the user
    //    (the generation already succeeded; we don't want to discard the result)
    try {
      await Promise.all([
        // Unlimited users don't consume the demo counter — keep it stable.
        unlimited
          ? Promise.resolve()
          : incrementGenerationCount(user.id, used),
        saveGeneration(user.id, {
          imageUrl: tryOnUrl,
          listingTitle: listing.title,
          listingDescription: listing.description,
          modelUsed: modelImage,
          language: listingLang,
        }),
      ]);
    } catch (dbErr) {
      // Non-fatal: generation succeeded, DB save failed — log and continue
      console.error("[/api/generate] DB save failed (non-fatal):", dbErr);
    }

    return NextResponse.json({ tryOnUrl, listing });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
