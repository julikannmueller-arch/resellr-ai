# CLAUDE.md — Resellr AI

Persistent context for AI coding sessions. Terse, decision-oriented. Not human docs.

## What it is
- AI toolkit for Vinted resellers (target: 16–25, streetwear/Y2K/vintage, DE market).
- One flow: upload garment photo → pick model → generate → AI try-on image + German Vinted listing side by side.
- Second tab "Sniper" = UI-only mockup, coming-soon. "History" tab = past generations.
- Entry point IS the generator (no marketing landing page).
- Live: https://resellr-ai-rho.vercel.app (Vercel, project `resellr-ai`, team `julikannmueller-archs-projects`).

## Tech stack
- **Next.js 14.2.35** App Router, TypeScript, React 18. **Do NOT upgrade to Next 15** without explicit ask (async request APIs = breaking).
- **Tailwind CSS** 3.4 + custom tokens. **Framer Motion** 12 for all animation.
- **Clerk** `@clerk/nextjs@^6.39.5` — auth. **Pinned to v6 on purpose** (v7 requires Next 15+; caused Vercel ERESOLVE fail). Every API used exists in v6.
- **Supabase** `@supabase/supabase-js@2` — Postgres (users + generations). Service-role key, server-side only.
- **OpenAI** `openai@6`, model **`gpt-4o-mini`** (vision) — listing text generation.
- **PiAPI** (`api.piapi.ai`), model `gemini`, task_type **selectable** (`nano-banana-pro` | `nano-banana-2`) — virtual try-on. Same `resolution` field for both: `"1K"` (standard) | `"4K"`. Chosen in UI, mapped by `lib/pricing.ts` `piapiParams()`. Env: `PIAPI_KEY`. Response image at `data.output.image_urls[0]`.
- **litterbox.catbox.moe** — temp image host (1h TTL) to hand PiAPI public URLs (base64 → URL).
- Manrope font via `next/font` (`--font-manrope`).

## Architecture
- `app/page.tsx` — tab state (`generator` | `history` | `sniper`), desktop nav + mobile BottomNav.
- `app/layout.tsx` — `<ClerkProvider>` inside `<body>` (NOT wrapping `<html>`), Manrope, dark bg.
- `app/api/generate/route.ts` — **image only**. auth → **burst rate limit** → getOrCreateUser → parse body (incl. `model`, `is4k`) → **credit check** (`checkCredits`) → resolve model image → `generateTryOn(…piapiParams)` → **deductCredits** + saveGeneration (listing cols null) → returns `{tryOnUrl, generationId, credits}`. maxDuration 120. **Listing is decoupled** — NOT generated here.
- `app/api/generate/listing/route.ts` — **on-demand listing text** (GPT-4o-mini). auth → burst rate limit (`${userId}:listing` window) → verify generation ownership (`getGeneration`) → **idempotent** (returns existing listing without a GPT call) → `generateListing` → `updateGenerationListing` on the SAME row → returns `{listing}`. **Costs NO credits** (image already paid). Body: `{generationId, garmentImage, listingLang}`.
- `lib/ratelimit.ts` — Upstash burst limiter, 5 req/min/user (sliding window), keyed by Clerk userId. Independent of the lifetime limit & `is_unlimited` — pure anti-burst. Lazy singleton, **fail-open** if `UPSTASH_REDIS_REST_URL`/`_TOKEN` unset (logs a warning, skips limiting). Test: `node scripts/test-ratelimit.mjs`.
- `app/api/user/status/route.ts` — returns `{ used, limit }`. Falls back to safe defaults if Supabase unconfigured (never crashes UI).
- `app/api/user/generations/route.ts` — history list for logged-in user.
- `app/api/download/route.ts` — image download proxy (`Content-Disposition: attachment`). Auth-gated + SSRF-guarded (https only, no internal hosts/IPs). Exists because PiAPI CDN has no CORS → client blob fetch fails.
- `app/sign-in|sign-up/[[...]]/page.tsx` — Clerk catch-all pages, black+green themed.
- `lib/tryon.ts` — PiAPI: upload imgs → create task → poll status (2s, max 60 tries) → return URL. `aspect_ratio: "9:16"`.
- `lib/openai.ts` — listing gen. Returns `{ title, description }` (hashtags baked into description, see decisions).
- `lib/supabase.ts` — lazy `getSupabase()`, types, `DEMO_GENERATION_LIMIT = 3`.
- `lib/supabase-helpers.ts` — `getOrCreateUser`, `checkGenerationLimit`, `incrementGenerationCount`, `saveGeneration`, `getUserGenerations`.
- `lib/i18n.ts` — DE/EN dict, `translations.{en,de}`, `T` type. `contexts/LangContext.tsx` provides `useLang()` → `{ t, uiLang, setUiLang }`.
- `components/` — GeneratorView (orchestrates flow), StreetrunnerGame (wait-time minigame), History/Results/Listing/TryOn, UploadZone, ModelPicker, Sniper, etc.
- `supabase/schema.sql` — run manually in Supabase SQL editor. `users` + `generations` tables, RLS enabled.

## Key decisions (+ why)
- **Clerk v6 pin** — v7 needs Next 15; downgrade was the low-risk fix vs framework upgrade. No code changes needed.
- **Lazy client init** (`getSupabase()`, formerly `getStripe()`) — module-level `createClient`/`new Stripe()` crashed the Next build when env empty. Never init clients at module scope.
- **Hashtags inside `listing_description`** — Vinted has no hashtag field. GPT appends 30–50 hashtags after 3 line breaks at end of description. `listing_hashtags` DB column dropped/unused.
- **All API routes derive identity from `await auth()`** (Clerk) → internal `user.id`. **NEVER trust a user_id from request body/query** — service-role key bypasses RLS, so route IS the access control.
- **Auth gating at component/API level, not middleware** — `clerkMiddleware()` leaves all routes public; checks live in handlers + `useUser()`.
- **`await auth()` is async** in Clerk v6/v7. `SignedIn`/`SignedOut` not used → use `useUser()` hook.
- **Download proxy** instead of client blob fetch — CORS on PiAPI CDN.
- **9:16 output** — mobile-first (Vinted is mobile). Set in PiAPI request + UI aspect ratios.
- **Streetrunner minigame** during generation wait — opt-in prompt ("Play"), fullscreen canvas runner, pauses on result-ready with Continue/Exit. Pure canvas (no assets). Highscore in localStorage.

## Current limitations / deliberate constraints
- **Credit system** (replaced the old 3-gen lifetime limit). `users.credits` (int, default 30). Price matrix in `lib/pricing.ts` (single source of truth, shared client+server): Nano Banana Pro=10 / +4K=15, Nano Banana 2=5 / +4K=10 (4K is a flat +5). Server derives cost from (model, is4k) — never trusts the client price. `checkCredits()` gates, `deductCredits()` charges after success. Migration: `supabase/migrations/002_credits_system.sql`.
- **`users.is_unlimited` bypass** — accounts flagged `is_unlimited=true` are exempt from credit deduction entirely (owner: julikannmueller@gmail.com, clerk id `user_3FxJ53EfGzLywNyfEhkRlL1jxCk`). Enforced server-side in `checkCredits()`; `/api/user/status` returns `{credits, unlimited}` so the UI shows an ∞ badge instead of the balance. Migration: `supabase/migrations/001_add_is_unlimited.sql` (flags by clerk_user_id — see email gotcha).
- **Rate-limit 429 → UI cooldown** — GeneratorView reads `Retry-After`, runs a per-second countdown (`cooldown` state + `t.rateLimited`), disables the Generate button, auto-re-enables at 0.
- **Stripe billing** (subscriptions + one-time credit packs). Catalog = `PLANS` in `lib/pricing.ts` (3 subs: Starter/Pro/Studio 150/350/800 cr; 3 packs: 100/300/700 cr). Client sends only the plan `key`; server resolves the price id from env (`STRIPE_PRICE_*`) — never trusts client amounts. `app/api/stripe/checkout` creates the session (customer per user). `app/api/stripe/webhook` is signature-verified + **idempotent** via `stripe_events` table: packs grant on `checkout.session.completed`, subs grant on `invoice.paid` (monthly), `subscription.deleted` sets status. Credits ADD (rollover) via atomic `increment_credits()` fn. `scripts/stripe-setup.mjs` (re)creates the Stripe catalog. **Currently TEST mode** — needs live keys + Stripe account verification before real payments.
- **Clerk = DEV instance keys** (`pk_test_`/`sk_test_`) in production. Deliberate: `*.vercel.app` CANNOT host a Clerk production instance (can't set required DNS/CNAME on Vercel-owned domain). Prod instance needs a real custom domain first. Dev keys work on any domain (shows small Clerk dev banner).
- **Sniper Feed** = static mock UI only.
- **Preset models** live in `public/models/model-XX.jpg` (`preset:model-XX` resolved server-side to base64).

## Open TODOs / next steps
- When real custom domain acquired: create Clerk prod instance + DNS, swap to `pk_live_`/`sk_live_`, update `NEXT_PUBLIC_APP_URL`.
- Re-add payments (Stripe) + real tiers when moving past demo.
- Build real Sniper Feed backend.
- 2 pre-existing npm audit vulns (1 moderate, 1 high) — unaddressed.
- Consider dropping unused `listing_hashtags` / `tier` / `stripe_*` columns.

## Conventions to keep
- **Design tokens** (`tailwind.config.ts`): `bg #0A0A0A`, `surface #181818`, `green #1ED760`, `text-primary/secondary/muted`. Radius `card 12px`/`input 8px`/`pill`. `shadow-glow-green`. Spotify-dark aesthetic.
- File refs in chat: markdown links, not backticks.
- Bilingual: every user-facing string goes through `lib/i18n.ts` (add to both `en` + `de`), access via `useLang().t`.
- Components: `"use client"` default; server logic in `app/api/*` + `lib/*`.
- Comments only for non-obvious constraints, match surrounding density.
- Listing tone (DE): emoji-heavy casual reseller voice, exact template in `lib/openai.ts` SYSTEM_PROMPT_DE — preserve structure (🩶5% Rabatt…, Zustand ✅, Versand 📦, Maße 📐, 30–50 hashtags).

## Tooling / CLI workflow (default working mode)
- **Prefer CLI/API over manual dashboard steps.** Do setup/deploy/migration/env-var tasks yourself via CLI — don't hand the user dashboard click-paths. Only fall back to manual steps if no CLI/API path exists or required credentials are missing (then ask for the missing secret, to be put in `.env.local`).
- **Vercel CLI** — linked + logged in (`julikannmueller-arch`, project `resellr-ai`). Use `npx vercel env add/rm/pull/ls`, `npx vercel deploy`. Env-var changes → do them here, not in the dashboard.
- **Supabase CLI / migrations** — needs `SUPABASE_ACCESS_TOKEN` (PAT) in `.env.local`; DB-history workflow also needs `SUPABASE_DB_PASSWORD`. With those: `supabase link --project-ref dcfrshwyvxqlrmxbgtnd` + `supabase db push`. Without the DB password, run SQL via the Management API: `POST https://api.supabase.com/v1/projects/dcfrshwyvxqlrmxbgtnd/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`. DDL (ALTER/CREATE) can NOT go through the service-role key/PostgREST — use one of these paths.
- **Secrets for CLIs** always live in `.env.local` (gitignored via `.env*.local`), never pasted into chat. Load per-command when needed (Bash doesn't auto-source `.env.local`).

## Gotchas / watch out
- **Uploads are downscaled client-side** (`lib/image.ts`, in UploadZone + ModelPicker) — canvas → JPEG q0.85, longest side ≤1600px. Reason: iPhone photos (3–12 MB, often HEIC) sent raw exceed **Vercel's ~4.5 MB serverless body limit** and fail on iOS Safari with a cryptic "string did not match the expected pattern" DOMException. Localhost has no such limit → the bug is prod/iOS-only. Keep uploads small; don't send raw camera images to `/api/generate`.
- **NEVER run `npm run build` while `next dev` is running** — both write `.next/`, corrupts dev asset serving (404s on CSS/JS). Verify with `tsc --noEmit` instead; only build when dev is stopped.
- **Secrets**: `.env.local` gitignored via `.env*.local`. Never commit/print secret keys. `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, `PIAPI_KEY` are secret; `NEXT_PUBLIC_*` are public by design.
- **Supabase env var** is `NEXT_PUBLIC_SUPABASE_URL` — must be bare origin, NO `/rest/v1/` suffix (client appends it; suffix → double path 404).
- **`users.email` is usually NULL** — rows are first created by `/api/user/status` or `/api/user/generations`, which call `getOrCreateUser(userId)` with NO email arg; `getOrCreateUser` returns early for existing rows and never backfills. So NEVER match a user by email in SQL/queries — use `clerk_user_id`. (Latent: no email-based feature will work until getOrCreateUser backfills email.)
- **Cost per generation**: 1 PiAPI try-on call (credits — ran out before, error `insufficient credits` code 10002) + 1 gpt-4o-mini vision call. Guard the 3-gen limit server-side.
- **PiAPI**: polling up to ~2min; can time out. Warnings like "invalid aspect ratio, use default" are non-fatal.
- **DB saves are non-fatal** in generate route — wrapped so a failed saveGeneration never discards a successful generation result.
- Vercel Prod/Preview env vars are stored **sensitive/write-only** → `vercel env pull` returns empty for them (not a bug). Development vars are readable.
- Global npm installs fail (EACCES on `/usr/local/lib`) — use `npx` or a temp `--prefix`.
