// Idempotently create the Resellr Stripe catalog (test or live, depending on the
// key in .env.local). Re-runnable: reuses prices by lookup_key. Prints the price
// IDs to paste into .env.local / Vercel.
//
//   node scripts/stripe-setup.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Stripe from "stripe";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.*?)\s*$/);
  if (m) process.env.STRIPE_SECRET_KEY = m[1].replace(/^["']|["']$/g, "");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" });

// key → {name, amount(cents), credits, recurring}
const CATALOG = [
  { key: "sub_starter", name: "Resellr Starter", amount: 999, credits: 150, recurring: true },
  { key: "sub_pro", name: "Resellr Pro", amount: 1999, credits: 350, recurring: true },
  { key: "sub_studio", name: "Resellr Studio", amount: 3999, credits: 800, recurring: true },
  { key: "pack_small", name: "100 Credits", amount: 799, credits: 100, recurring: false },
  { key: "pack_medium", name: "300 Credits", amount: 1999, credits: 300, recurring: false },
  { key: "pack_large", name: "700 Credits", amount: 3999, credits: 700, recurring: false },
];

const envLines = [];
for (const item of CATALOG) {
  // Reuse if a price with this lookup_key already exists.
  const existing = await stripe.prices.list({ lookup_keys: [item.key], limit: 1 });
  let price = existing.data[0];
  if (price) {
    console.log(`↺ reuse ${item.key} → ${price.id}`);
  } else {
    const product = await stripe.products.create({
      name: item.name,
      metadata: { key: item.key, kind: item.recurring ? "subscription" : "pack", credits: String(item.credits) },
    });
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: item.amount,
      currency: "eur",
      lookup_key: item.key,
      ...(item.recurring ? { recurring: { interval: "month" } } : {}),
      metadata: { key: item.key, kind: item.recurring ? "subscription" : "pack", credits: String(item.credits) },
    });
    console.log(`✓ created ${item.key} (€${(item.amount / 100).toFixed(2)}, ${item.credits} cr) → ${price.id}`);
  }
  envLines.push(`STRIPE_PRICE_${item.key.toUpperCase()}=${price.id}`);
}

console.log("\n--- paste into .env.local + Vercel ---");
console.log(envLines.join("\n"));
