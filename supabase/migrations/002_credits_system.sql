-- ============================================================
-- Migration: credit system (replaces the 3-generation lifetime limit)
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Idempotent — safe to run more than once.
-- ============================================================

-- 1. Add the credit balance. `default 30` also backfills existing rows to 30.
alter table public.users
  add column if not exists credits integer not null default 30;

-- NOTE: is_unlimited (from migration 001) is intentionally left untouched here —
-- the owner account stays unlimited. The old limit used `generations_used_this_month`;
-- that column is now unused (kept for history) and no longer gates access.

-- 2. Verify — owner is_unlimited=true; every user has a credits balance.
select email, clerk_user_id, credits, is_unlimited
  from public.users
  order by created_at;
