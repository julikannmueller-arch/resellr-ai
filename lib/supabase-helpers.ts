/**
 * Supabase helper functions.
 *
 * Security contract: every function that touches user data derives the lookup
 * key from a `clerkUserId` that the CALLER obtained via `await auth()`.
 * No function in this file accepts a user identifier from untrusted input.
 * After the initial user lookup, subsequent updates use the internal UUID (`id`)
 * as the primary key — never data from outside the server.
 */

import { getSupabase, type UserRecord, type GenerationRecord } from "./supabase";
import { STARTING_CREDITS } from "./pricing";

export interface GenerationData {
  imageUrl: string;
  /** Model photo reference (e.g. "preset:model-01" or a base64 data URL). */
  modelUsed: string;
  /** Chosen AI model: "pro" | "nb2". */
  aiModel: string;
  /** Chosen resolution: "1K" | "4K". */
  resolution: string;
  language: "de" | "en";
  /** Listing is optional — generated later on demand, otherwise null. */
  listingTitle?: string | null;
  /** Full description — hashtags are included at the end (Vinted has no separate field) */
  listingDescription?: string | null;
}

/**
 * Returns the user record for the given Clerk user ID, creating one if it
 * doesn't exist yet. New users start with STARTING_CREDITS.
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
      credits: STARTING_CREDITS,
    })
    .select()
    .single<UserRecord>();

  if (!created) {
    throw new Error(`Failed to create user record: ${error?.message}`);
  }
  return created;
}

/**
 * Credit check for a generation costing `cost` credits.
 *
 * Exception: users flagged `is_unlimited` in the DB are exempt — always allowed
 * and never charged. This flag lives server-side and is read here, so it cannot
 * be forged by the client; the generate route calls this before generating.
 */
export function checkCredits(
  user: UserRecord,
  cost: number
): {
  allowed: boolean;
  credits: number;
  unlimited: boolean;
  /** How many credits short (0 when allowed). */
  missing: number;
} {
  const unlimited = user.is_unlimited === true;
  const credits = user.credits ?? 0;
  const allowed = unlimited || credits >= cost;
  return { allowed, credits, unlimited, missing: allowed ? 0 : cost - credits };
}

/**
 * Deducts `cost` credits from a user, clamped at 0.
 *
 * Read-then-write (optimistic) — matches this app's single-user, rate-limited
 * usage. Concurrent requests are already throttled to 5/min by the burst limiter,
 * so a lost-update race is not a practical concern here.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 * @param currentCredits — balance read during the credit check
 * @returns the new balance
 */
export async function deductCredits(
  userId: string,
  currentCredits: number,
  cost: number
): Promise<number> {
  const supabase = getSupabase();
  const next = Math.max(0, currentCredits - cost);
  await supabase.from("users").update({ credits: next }).eq("id", userId);
  return next;
}

/**
 * Saves a generation (image first). Listing fields default to null and are
 * filled in later by updateGenerationListing() only if the user opts in.
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
      listing_title: data.listingTitle ?? null,
      listing_description: data.listingDescription ?? null,
      model_used: data.modelUsed,
      ai_model: data.aiModel,
      resolution: data.resolution,
      language: data.language,
    })
    .select()
    .single<GenerationRecord>();

  return row;
}

/**
 * Atomically adds `amount` credits to a user (Postgres increment_credits fn) —
 * safe against concurrent webhook grants. Returns the new balance.
 *
 * @param userId — internal UUID from `users.id`
 */
export async function grantCredits(userId: string, amount: number): Promise<number | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("increment_credits", { uid: userId, amt: amount });
  if (error) throw error;
  return typeof data === "number" ? data : null;
}

/**
 * Records a Stripe event id so it's processed at most once. Returns true if this
 * is the FIRST time we've seen it (caller should process), false if it's a
 * duplicate/replay (caller should skip). Relies on the primary-key uniqueness.
 */
export async function markStripeEventProcessed(eventId: string, type: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("stripe_events").insert({ id: eventId, type });
  if (error) {
    if (error.code === "23505") return false; // duplicate → already processed
    throw error;
  }
  return true;
}

/**
 * Finds a user by their Clerk id (no creation). Used by the webhook, which has
 * no auth context. Returns null if unknown.
 */
export async function getUserByClerkId(clerkUserId: string): Promise<UserRecord | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single<UserRecord>();
  return data ?? null;
}

/** Finds a user by Stripe customer id (for invoice/subscription webhooks). */
export async function getUserByStripeCustomer(customerId: string): Promise<UserRecord | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .single<UserRecord>();
  return data ?? null;
}

/** Persists a user's Stripe customer id. */
export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
}

/** Updates subscription state (status + plan key + optional subscription id). */
export async function setSubscription(
  userId: string,
  fields: { status: string | null; plan?: string | null; subscriptionId?: string | null }
): Promise<void> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = { subscription_status: fields.status };
  if (fields.plan !== undefined) update.subscription_plan = fields.plan;
  if (fields.subscriptionId !== undefined) update.stripe_subscription_id = fields.subscriptionId;
  await supabase.from("users").update(update).eq("id", userId);
}

/**
 * Loads one generation, scoped to its owner. Returns null if it doesn't exist
 * or belongs to someone else — this is the ownership gate for the listing route.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 */
export async function getGeneration(
  userId: string,
  generationId: string
): Promise<GenerationRecord | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .single<GenerationRecord>();

  return data ?? null;
}

/**
 * Fills in the listing text for an existing generation. Scoped to the owner via
 * both id and user_id so a forged id can't overwrite someone else's row.
 *
 * @param userId — internal UUID from `users.id`, derived from a verified UserRecord
 */
export async function updateGenerationListing(
  userId: string,
  generationId: string,
  title: string,
  description: string,
  language: "de" | "en"
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("generations")
    .update({
      listing_title: title,
      listing_description: description,
      language,
    })
    .eq("id", generationId)
    .eq("user_id", userId);
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
