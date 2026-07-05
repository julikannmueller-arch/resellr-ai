-- ============================================================
-- Migration: add users.is_unlimited + flag owner account
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Idempotent — safe to run more than once.
-- ============================================================

-- 1. Add the column (default false, so all existing users stay limited to 3).
alter table public.users
  add column if not exists is_unlimited boolean not null default false;

-- 2. Grant unlimited generations to the owner account.
--    NOTE: existing rows have email = NULL (rows are first created by the
--    status/generations routes, which call getOrCreateUser WITHOUT an email),
--    so matching on email would update 0 rows. We match on the Clerk user id
--    instead (resolved from Clerk for julikannmueller@gmail.com) and backfill
--    the email at the same time.
update public.users
  set is_unlimited = true,
      email = 'julikannmueller@gmail.com'
  where clerk_user_id = 'user_3FxJ53EfGzLywNyfEhkRlL1jxCk';

-- 3. Verify — should return exactly one row with is_unlimited = true.
select id, email, clerk_user_id, is_unlimited, generations_used_this_month
  from public.users
  where clerk_user_id = 'user_3FxJ53EfGzLywNyfEhkRlL1jxCk';
