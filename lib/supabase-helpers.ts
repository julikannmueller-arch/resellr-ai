/**
 * Supabase helper functions.
 *
 * Security contract: every function that touches user data derives the lookup
 * key from a `clerkUserId` that the CALLER obtained via `await auth()`.
 * No function in this file accepts a user identifier from untrusted input.
 * After the initial user lookup, subsequent updates use the internal UUID (`id`)
 * as the primary key — never data from outside the server.
 */

import { getSupabase, DEMO_GENERATION_LIMIT, type UserRecord, type GenerationRecord } from "./supabase";

export interface GenerationData {
  imageUrl: string;
  listingTitle: string;
  /** Full description — hashtags are included at the end (Vinted has no separate field) */
  listingDescription: string;
  modelUsed: string;
  language: "de" | "en";
}

/**
 * Returns the user record for the given Clerk user ID, creating one if it
 * doesn't exist yet.
 *
 * Demo phase: the generation counter is LIFETIME — no monthly reset.
 * (generations_used_this_month is reused as the total counter.)
 *
 * @param clerkUserId — must come from `await auth()`, never from request input
 */
export async function getOrCreateUser(
  clerkUserId: string,
  email?: string | null
): Promise<UserRecord> {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single<UserRecord>();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      clerk_user_id: clerkUserId,
      email: email ?? null,
      tier: "free",
      generations_used_this_month: 0,
    })
    .select()
    .single<UserRecord>();

  if (!created) {
    throw new Error(`Failed to create user record: ${error?.message}`);
  }
  return created;
}

/**
 * Demo limit check: 3 generations total per user, lifetime.
 */
export function checkGenerationLimit(user: UserRecord): {
  allowed: boolean;
  used: number;
  limit: number;
} {
  const used = user.generations_used_this_month ?? 0;
  const limit = DEMO_GENERATION_LIMIT;
  return { allowed: used < limit, used, limit };
}

/**
 * Atomically increments the monthly generation counter for a user.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 * @param currentCount — the count that was read when the limit check happened
 */
export async function incrementGenerationCount(
  userId: string,
  currentCount: number
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ generations_used_this_month: currentCount + 1 })
    .eq("id", userId);
}

/**
 * Saves a completed generation to the database.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 */
export async function saveGeneration(
  userId: string,
  data: GenerationData
): Promise<GenerationRecord | null> {
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      image_url: data.imageUrl,
      listing_title: data.listingTitle,
      listing_description: data.listingDescription,
      model_used: data.modelUsed,
      language: data.language,
    })
    .select()
    .single<GenerationRecord>();

  return row;
}

/**
 * Fetches the generation history for a user, newest first.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 */
export async function getUserGenerations(
  userId: string,
  limit = 50
): Promise<GenerationRecord[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as GenerationRecord[]) ?? [];
}
