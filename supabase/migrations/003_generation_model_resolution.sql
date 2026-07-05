-- ============================================================
-- Migration: store the chosen AI model + resolution per generation
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Idempotent — safe to run more than once.
-- ============================================================
-- Decoupled flow: the try-on image is saved immediately; the listing
-- (listing_title / listing_description) is filled in later ONLY if the user
-- opts to generate a description — otherwise those columns stay null.

alter table public.generations
  add column if not exists ai_model text;      -- "pro" | "nb2"

alter table public.generations
  add column if not exists resolution text;    -- "1K" | "4K"

-- Verify
select id, image_url is not null as has_image, ai_model, resolution,
       listing_description is not null as has_listing, created_at
  from public.generations
  order by created_at desc
  limit 5;
