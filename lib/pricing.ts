/**
 * Credit pricing for try-on generation — the single source of truth shared by
 * BOTH the client (to show the live price) and the server (to charge).
 *
 * Price matrix:
 *   Nano Banana Pro (standard) → 10   |  Pro + 4K → 15
 *   Nano Banana 2  (standard) →  5   |  2   + 4K → 10
 * (4K is a flat +5 surcharge on either model.)
 */

export type TryOnModel = "pro" | "nb2";

export interface PricingInput {
  model: TryOnModel;
  is4k: boolean;
}

/** Credits a brand-new user starts with (must match the DB column default). */
export const STARTING_CREDITS = 30;

/** Base cost per model at standard resolution. */
const BASE_COST: Record<TryOnModel, number> = {
  pro: 10, // Nano Banana Pro
  nb2: 5, // Nano Banana 2
};

/** Flat surcharge added when 4K is selected. */
const FOUR_K_SURCHARGE = 5;

/** Human-facing brand labels (not translated — proper nouns). */
export const MODEL_LABELS: Record<TryOnModel, string> = {
  pro: "Nano Banana Pro",
  nb2: "Nano Banana 2",
};

/** Credits charged for a given (model, resolution) combination. */
export function creditCost({ model, is4k }: PricingInput): number {
  return BASE_COST[model] + (is4k ? FOUR_K_SURCHARGE : 0);
}

/** Maps a UI choice to the PiAPI task_type + resolution string. */
export function piapiParams({ model, is4k }: PricingInput): {
  taskType: "nano-banana-pro" | "nano-banana-2";
  resolution: "1K" | "4K";
} {
  return {
    taskType: model === "pro" ? "nano-banana-pro" : "nano-banana-2",
    resolution: is4k ? "4K" : "1K",
  };
}

/** Runtime guard for untrusted input (request body). */
export function isTryOnModel(v: unknown): v is TryOnModel {
  return v === "pro" || v === "nb2";
}

// ── Stripe plan catalog ─────────────────────────────────────────────────────
// Client-safe (no secrets — `priceEnv` is just the NAME of a server env var the
// checkout route resolves to a real Stripe price id). Credits here MUST match
// the metadata on the Stripe prices (scripts/stripe-setup.mjs).

export type PlanKind = "subscription" | "pack";

export interface Plan {
  key: string;
  kind: PlanKind;
  credits: number;
  priceEur: number;
  label: string;
  /** Name of the env var holding this plan's Stripe price id (server-only). */
  priceEnv: string;
}

export const PLANS: Plan[] = [
  { key: "sub_starter", kind: "subscription", credits: 150, priceEur: 9.99, label: "Starter", priceEnv: "STRIPE_PRICE_SUB_STARTER" },
  { key: "sub_pro", kind: "subscription", credits: 350, priceEur: 19.99, label: "Pro", priceEnv: "STRIPE_PRICE_SUB_PRO" },
  { key: "sub_studio", kind: "subscription", credits: 800, priceEur: 39.99, label: "Studio", priceEnv: "STRIPE_PRICE_SUB_STUDIO" },
  { key: "pack_small", kind: "pack", credits: 100, priceEur: 7.99, label: "100 Credits", priceEnv: "STRIPE_PRICE_PACK_SMALL" },
  { key: "pack_medium", kind: "pack", credits: 300, priceEur: 19.99, label: "300 Credits", priceEnv: "STRIPE_PRICE_PACK_MEDIUM" },
  { key: "pack_large", kind: "pack", credits: 700, priceEur: 39.99, label: "700 Credits", priceEnv: "STRIPE_PRICE_PACK_LARGE" },
];

export const planByKey = (key: string): Plan | undefined =>
  PLANS.find((p) => p.key === key);
