-- Removes the "season" concept from the team page and team cards. Safe to run more than once.

-- 1. The public view reads season, so it has to be rebuilt before the column can go.
drop view if exists public.public_team_list;
create view public.public_team_list with (security_invoker = true) as
  select id, name, role, department, leadership_order, bio, photo_url, social_links, sort_order,
         member_code, card_subtitle, level, accent, photo_position
  from public.team_members where status = 'published';
grant select on public.public_team_list to anon, authenticated;

alter table public.team_members drop column if exists season;

-- 2. Saved team page text: drop the season map label and the 2026—27 eyebrow.
update public.site_settings
set value = (value - 'map_season') || jsonb_build_object(
  'eyebrow', btrim(regexp_replace(coalesce(value->>'eyebrow', ''), '\s*2026\s*[—–-]\s*27', '', 'g')))
where key = 'team_page';

-- 3. Advisory heading in title case, matching the other sections.
update public.team_departments set heading = 'Advisory Board' where slug = 'advisory';
