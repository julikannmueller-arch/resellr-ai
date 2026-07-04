-- ============================================================
-- Resellr AI — Supabase Schema
-- Paste this into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Table: users
-- ============================================================
create table if not exists public.users (
  id                          uuid        primary key default gen_random_uuid(),
  clerk_user_id               text        unique not null,
  email                       text,
  tier                        text        not null default 'free'
                                          check (tier in ('free', 'pro', 'unlimited')),
  stripe_customer_id          text,
  stripe_subscription_id      text,
  generations_used_this_month int         not null default 0,
  generations_reset_at        timestamptz,
  created_at                  timestamptz not null default now()
);

-- ============================================================
-- Table: generations
-- ============================================================
-- Note: hashtags live at the end of listing_description (Vinted has no
-- separate hashtag field). If your DB still has the old listing_hashtags
-- column, it can stay (unused) or be dropped:
--   alter table public.generations drop column if exists listing_hashtags;
create table if not exists public.generations (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.users(id) on delete cascade,
  image_url            text,
  listing_title        text,
  listing_description  text,
  model_used           text,
  language             text        not null default 'de',
  created_at           timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_users_clerk_user_id
  on public.users (clerk_user_id);

create index if not exists idx_generations_user_id
  on public.generations (user_id);

create index if not exists idx_generations_created_at
  on public.generations (created_at desc);

-- ============================================================
-- Row Level Security
--
-- NOTE: All server-side API routes use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS automatically — so these policies only apply
-- if the anon/public key is ever used (e.g. future client-side reads).
--
-- Clerk JWT uses 'sub' as the user identifier (e.g. "user_xxxx").
-- The policy below reads the clerk_user_id from the JWT 'sub' claim.
-- To activate this for client-side use, you'd also need to configure
-- Supabase to accept Clerk's JWT (via JWKS endpoint in Auth settings).
-- ============================================================

alter table public.users enable row level security;
alter table public.generations enable row level security;

-- Users: a user may only select/update their own row
create policy "users_select_own"
  on public.users for select
  using (
    clerk_user_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    )
  );

create policy "users_update_own"
  on public.users for update
  using (
    clerk_user_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    )
  );

-- Generations: a user may only select rows belonging to their user record
create policy "generations_select_own"
  on public.generations for select
  using (
    user_id in (
      select id from public.users
      where clerk_user_id = (
        current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
      )
    )
  );
