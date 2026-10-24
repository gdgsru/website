-- Migration: add verified column to community_points
-- Run in Supabase SQL Editor if you see "missing cp.verified" in Mission Control.

alter table public.community_points
  add column if not exists verified boolean not null default true;

-- Recreate the public_main_leaderboard view to expose verified flag
-- (only count verified points in the ranked standings)
create or replace view public.public_main_leaderboard with (security_invoker = true) as
  select period_id, period_title, student_name, points,
         dense_rank() over (partition by period_id order by points desc) as rank
  from public.public_main_leaderboard_cache;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
