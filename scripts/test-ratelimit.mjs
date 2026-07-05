// Standalone check for the generate-endpoint burst limiter.
// Runs the SAME config as lib/ratelimit.ts (5 req / 1 min sliding window)
// against your real Upstash DB — no auth, no dev server, no paid API calls.
//
//   node scripts/test-ratelimit.mjs
//
// Fires 7 requests with one fresh key: #1–#5 pass, #6–#7 are blocked (429).
// Optional: delete this file once you've confirmed it works.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Load UPSTASH_* from .env.local (Node doesn't read it automatically).
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*(UPSTASH_REDIS_REST_(?:URL|TOKEN))\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error(
    "❌ UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not found in .env.local.\n" +
      "   Add both (from the Upstash console) and re-run."
  );
  process.exit(1);
}

const rl = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:generate",
});

const key = `test-user-${Date.now()}`; // fresh key each run → clean window
console.log(`Firing 7 requests with key "${key}" (limit: 5/min)\n`);

for (let i = 1; i <= 7; i++) {
  const { success, remaining, reset } = await rl.limit(key);
  const when = success ? "✅ allowed" : "🚫 BLOCKED (429)";
  const secs = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  console.log(`#${i}: ${when}  remaining=${remaining}  resets in ~${secs}s`);
}

console.log("\nExpected: #1–#5 allowed, #6–#7 blocked.");
