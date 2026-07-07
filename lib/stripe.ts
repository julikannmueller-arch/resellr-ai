import Stripe from "stripe";
import { PLANS, type Plan } from "./pricing";

// Lazy singleton — module-level `new Stripe()` crashes the Next build when env
// is empty (same reason getSupabase() is lazy).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return _stripe;
}

/** Resolve a plan key → its Stripe price id (server-only env lookup). */
export function priceIdForKey(key: string): string | undefined {
  const plan = PLANS.find((p) => p.key === key);
  return plan ? process.env[plan.priceEnv] : undefined;
}

/** Reverse: a Stripe price id → its plan (used when reading webhook events). */
export function planForPriceId(priceId: string): Plan | undefined {
  return PLANS.find((p) => process.env[p.priceEnv] === priceId);
}
