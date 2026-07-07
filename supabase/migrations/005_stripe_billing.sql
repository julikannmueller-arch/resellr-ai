-- ============================================================
-- Migration: Stripe billing (credit packs + subscriptions)
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Idempotent — safe to run more than once.
-- ============================================================

-- Processed Stripe events → webhook idempotency (never double-grant credits).
create table if not exists public.stripe_events (
  id          text        primary key,   -- Stripe event id (evt_...)
  type        text,
  created_at  timestamptz not null default now()
);

-- Subscription state on the user (credits are just added to users.credits).
alter table public.users add column if not exists subscription_status text;  -- active | canceled | null
alter table public.users add column if not exists subscription_plan   text;  -- plan key, e.g. "sub_pro"

-- Atomic credit grant — avoids read-then-write races between concurrent webhooks.
create or replace function public.increment_credits(uid uuid, amt int)
returns int
language sql
as $$
  update public.users set credits = credits + amt where id = uid returning credits;
$$;

-- Verify
select
  (select count(*) from public.stripe_events) as events_rows,
  exists(select 1 from information_schema.columns where table_name='users' and column_name='subscription_status') as has_sub_status,
  exists(select 1 from pg_proc where proname='increment_credits') as has_increment_fn;
