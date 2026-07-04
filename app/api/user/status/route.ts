import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase, TIER_LIMITS, type SubscriptionTier } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data: user } = await supabase
    .from("users")
    .select("subscription_tier, generations_used_this_month, generations_reset_at")
    .eq("clerk_user_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ tier: "free", used: 0, limit: 3, resetAt: null });
  }

  const tier = (user.subscription_tier ?? "free") as SubscriptionTier;
  const limit = TIER_LIMITS[tier];

  return NextResponse.json({
    tier,
    used: user.generations_used_this_month ?? 0,
    limit: limit === Infinity ? null : limit,
    resetAt: user.generations_reset_at,
  });
}
