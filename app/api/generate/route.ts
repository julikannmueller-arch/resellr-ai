import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { auth } from "@clerk/nextjs/server";
import { generateTryOn } from "@/lib/tryon";
import { generateListing } from "@/lib/openai";
import { getSupabase, TIER_LIMITS, type SubscriptionTier, type UserRecord } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to generate", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const supabase = getSupabase();

  // Get or create user record
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", userId)
    .single<UserRecord>();

  if (!user) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    const { data: created } = await supabase
      .from("users")
      .insert({
        clerk_user_id: userId,
        subscription_tier: "free",
        generations_used_this_month: 0,
        generations_reset_at: nextReset.toISOString(),
      })
      .select()
      .single<UserRecord>();

    user = created;
  }

  if (!user) {
    return NextResponse.json(
      { error: "Failed to retrieve user record" },
      { status: 500 }
    );
  }

  // Reset monthly counter if reset date has passed
  if (user.generations_reset_at && new Date(user.generations_reset_at) <= new Date()) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    const { data: reset } = await supabase
      .from("users")
      .update({
        generations_used_this_month: 0,
        generations_reset_at: nextReset.toISOString(),
      })
      .eq("clerk_user_id", userId)
      .select()
      .single<UserRecord>();

    if (reset) user = reset;
  }

  // Check generation limit
  const tier = (user.subscription_tier ?? "free") as SubscriptionTier;
  const limit = TIER_LIMITS[tier];
  const used = user.generations_used_this_month ?? 0;

  if (limit !== Infinity && used >= limit) {
    return NextResponse.json(
      {
        error: `You've used all ${limit} generations for this month. Upgrade to continue.`,
        code: "LIMIT_REACHED",
        tier,
        used,
        limit,
      },
      { status: 403 }
    );
  }

  // Parse request body
  try {
    const body = await request.json();
    const { garmentImages, modelImage, listingLang = "de" } = body as {
      garmentImages: string[];
      modelImage: string;
      listingLang?: "en" | "de";
    };

    if (!garmentImages || garmentImages.length === 0) {
      return NextResponse.json(
        { error: "No clothing photo uploaded" },
        { status: 400 }
      );
    }

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

    const garmentImage = garmentImages[0];

    const [tryOnUrl, listing] = await Promise.all([
      generateTryOn(resolvedModelImage, garmentImage),
      generateListing(garmentImage, listingLang),
    ]);

    // Increment generation counter on success
    await supabase
      .from("users")
      .update({ generations_used_this_month: used + 1 })
      .eq("clerk_user_id", userId);

    return NextResponse.json({ tryOnUrl, listing });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
