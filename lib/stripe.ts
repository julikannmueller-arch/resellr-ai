import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

export const STRIPE_PRICES: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
};

export function tierFromPriceId(priceId: string): "free" | "pro" | "unlimited" {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED) return "unlimited";
  return "free";
}
