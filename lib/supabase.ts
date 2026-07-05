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
  // When true, this user bypasses DEMO_GENERATION_LIMIT entirely (owner/comp accounts).
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
  language: string;
  created_at: string;
}

// Demo phase: every user gets 3 generations total (lifetime, no reset).
// The tier column still exists in the DB but is unused for now.
export const DEMO_GENERATION_LIMIT = 3;

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
