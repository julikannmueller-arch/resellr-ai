-- ============================================================
-- Migration: lower the free starting credits 30 → 10 (launch cost cap)
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Idempotent — safe to run more than once.
-- ============================================================
-- Only affects NEW signups. Existing rows keep their current balance.
-- Must stay in sync with STARTING_CREDITS in lib/pricing.ts.

alter table public.users
  alter column credits set default 10;

-- Verify the default
select column_default
  from information_schema.columns
  where table_name = 'users' and column_name = 'credits';
