import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "pro" | "unlimited";

export interface UserRecord {
  id: string;
  clerk_user_id: string;
  email: string | null;
  tier: Tier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  generations_used_this_month: number;
  generations_reset_at: string | null;
  // Credit balance. Each try-on costs credits per lib/pricing.ts. New users start at 30.
  credits: number;
  // When true, this user is exempt from credit deduction entirely (owner/comp accounts).
  is_unlimited: boolean;
  created_at: string;
}

export interface GenerationRecord {
  id: string;
  user_id: string;
  image_url: string | null;
  listing_title: string | null;
  listing_description: string | null;
  model_used: string | null;
  // Chosen AI model ("pro" | "nb2") and resolution ("1K" | "4K").
  ai_model: string | null;
  resolution: string | null;
  language: string;
  created_at: string;
}

// Access is governed by the credit balance (users.credits) — see lib/pricing.ts.
// The old 3-generation lifetime limit has been removed. The `tier` and
// `generations_used_this_month` columns still exist in the DB but are unused.

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
