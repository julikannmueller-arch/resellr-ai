import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasses RLS, only used server-side in API routes
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type SubscriptionTier = "free" | "pro" | "unlimited";

export interface UserRecord {
  id: string;
  clerk_user_id: string;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  generations_used_this_month: number;
  generations_reset_at: string | null;
  created_at: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  pro: 100,
  unlimited: Infinity,
};
