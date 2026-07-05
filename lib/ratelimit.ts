/**
 * Burst protector for /api/generate.
 *
 * INDEPENDENT of the lifetime demo limit (DEMO_GENERATION_LIMIT) and the
 * `is_unlimited` flag. Its only job is to stop rapid-fire duplicate/buggy
 * requests (e.g. a double-submit or a runaway loop) — 5 requests per minute
 * per Clerk user, sliding window. It does NOT change how many generations a
 * user is allowed in total; the lifetime check runs separately after this.
 *
 * Lazy singleton (module-scope client init crashes the Next build when env is
 * empty — same reason getSupabase() is lazy).
 *
 * Fail-open: if the Upstash env vars are missing, rate limiting is skipped
 * (logged once) rather than blocking all generation. The lifetime limit still
 * guards cost in that case.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _limiter: Ratelimit | null = null;
let _initTried = false;

function getLimiter(): Ratelimit | null {
  if (_initTried) return _limiter;
  _initTried = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn(
      "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting DISABLED"
    );
    return null;
  }

  _limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:generate",
    analytics: false,
  });
  return _limiter;
}

export interface RateLimitResult {
  /** false → over the burst limit, caller should return 429 */
  success: boolean;
  /** requests left in the current window (-1 when limiting is disabled) */
  remaining: number;
  /** epoch ms when the window resets (0 when disabled) */
  reset: number;
}

/**
 * @param key — the Clerk userId (per-account limiting, NOT per-IP), from `await auth()`
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const limiter = getLimiter();
  if (!limiter) {
    // Not configured → fail open. Lifetime limit still guards cost.
    return { success: true, remaining: -1, reset: 0 };
  }
  const { success, remaining, reset } = await limiter.limit(key);
  return { success, remaining, reset };
}
