import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    _client = createClient(url, key);
  }
  return _client;
}
