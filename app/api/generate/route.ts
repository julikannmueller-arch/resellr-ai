import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { auth, currentUser } from "@clerk/nextjs/server";
import { generateTryOn } from "@/lib/tryon";
import {
  getOrCreateUser,
  checkCredits,
  deductCredits,
  saveGeneration,
} from "@/lib/supabase-helpers";
import { checkRateLimit } from "@/lib/ratelimit";
import { creditCost, piapiParams, isTryOnModel, type TryOnModel } from "@/lib/pricing";

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

  // ── 3. Parse and validate request body ─────────────────────────────────────
  let garmentImages: string[];
  let modelImage: string;
  let listingLang: "de" | "en";
  let model: TryOnModel;
  let is4k: boolean;

  try {
    const body = await request.json();
    garmentImages = body.garmentImages;
    modelImage = body.modelImage;
    listingLang = body.listingLang === "en" ? "en" : "de";
    // Model + resolution drive the price — validate strictly so we never mischarge.
    if (!isTryOnModel(body.model)) {
      return NextResponse.json({ error: "Invalid model selection" }, { status: 400 });
    }
    model = body.model;
    is4k = body.is4k === true;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(garmentImages) || garmentImages.length === 0) {
    return NextResponse.json({ error: "No clothing photo uploaded" }, { status: 400 });
  }
  if (typeof modelImage !== "string" || modelImage.trim() === "") {
    return NextResponse.json({ error: "No model selected" }, { status: 400 });
  }

  // ── 4. Enforce credits ──────────────────────────────────────────────────────
  //    Cost is derived server-side from (model, 4K) — the client-sent price is
  //    never trusted. Users flagged `is_unlimited` are exempt (checkCredits
  //    returns allowed=true and is never charged). This gate lives here in the
  //    API route so the client cannot bypass it.
  const cost = creditCost({ model, is4k });
  const { allowed, credits, unlimited, missing } = checkCredits(user, cost);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Not enough credits: this generation costs ${cost}, you have ${credits} (${missing} short).`,
        code: "INSUFFICIENT_CREDITS",
        cost,
        credits,
        missing,
      },
      { status: 402 }
    );
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

  // ── 6. Run try-on ONLY ──────────────────────────────────────────────────────
  //    The listing (GPT-4o-mini) is decoupled: generated on demand later via
  //    /api/generate/listing, so a user who only wants the image pays no GPT cost.
  try {
    const garmentImage = garmentImages[0];
    const tryOnUrl = await generateTryOn(
      resolvedModelImage,
      garmentImage,
      piapiParams({ model, is4k })
    );

    // ── 7. Charge credits + persist the generation (listing fields stay null).
    //    We need the saved row id so the client can request the listing later;
    //    a DB error is non-fatal for the result but then no listing is possible.
    let remainingCredits = credits;
    let generationId: string | null = null;
    try {
      const [deducted, saved] = await Promise.all([
        unlimited ? Promise.resolve(credits) : deductCredits(user.id, credits, cost),
        saveGeneration(user.id, {
          imageUrl: tryOnUrl,
          modelUsed: modelImage,
          aiModel: model,
          resolution: is4k ? "4K" : "1K",
          language: listingLang,
        }),
      ]);
      remainingCredits = deducted;
      generationId = saved?.id ?? null;
    } catch (dbErr) {
      // Non-fatal: generation succeeded, DB write failed — log and continue.
      console.error("[/api/generate] DB write failed (non-fatal):", dbErr);
    }

    return NextResponse.json({ tryOnUrl, generationId, credits: remainingCredits, unlimited });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
