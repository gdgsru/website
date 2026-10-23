-- GDG SRU official links/contact update.
-- Run once on an existing initialized project. Patches the six standard links while preserving custom social platforms.
begin;

insert into public.site_settings(key, value) values
  ('social_links', '[]'::jsonb),
  ('contact_email', '"gdg@sru.edu.in"'::jsonb),
  ('secondary_contact_email', '"gdgoncamps.sru@gmail.com"'::jsonb)
on conflict (key) do nothing;

update public.site_settings s
set value = (
  with defaults(item) as (
    select * from jsonb_array_elements(
      '[
        {"key":"gdg","label":"Google Developer Group SR University","url":"https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/","description":"The official chapter page for community updates and event registration.","icon":"✦","enabled":true,"sort_order":1},
        {"key":"linkedin","label":"LinkedIn","url":"https://www.linkedin.com/company/gdg-sru/home/","description":"Follow chapter news, achievements, and announcements.","icon":"in","enabled":true,"sort_order":2},
        {"key":"discord","label":"Discord","url":"https://discord.gg/htSJMNcdZs","description":"Join conversations, study groups, and project teams.","icon":"◉","enabled":true,"sort_order":3},
        {"key":"instagram","label":"Instagram","url":"https://www.instagram.com/gdg_sru/","description":"See chapter moments, event photos, and announcements.","icon":"◎","enabled":true,"sort_order":4},
        {"key":"x","label":"X","url":"https://x.com/gdgsru","description":"Follow quick updates and technology conversations.","icon":"𝕏","enabled":true,"sort_order":5},
        {"key":"github","label":"GitHub","url":"https://github.com/gdgsru","description":"Explore shared projects and open-source work.","icon":"⌘","enabled":true,"sort_order":6}
      ]'::jsonb
    )
  ),
  existing(item, ord) as (
    select e.item, e.ordinality
    from jsonb_array_elements(
      case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end
    ) with ordinality as e(item, ordinality)
  ),
  patched(item, ord) as (
    select
      case existing.item->>'key'
        when 'linkedin' then existing.item || '{"url":"https://www.linkedin.com/company/gdg-sru/home/"}'::jsonb
        when 'discord' then existing.item || '{"url":"https://discord.gg/htSJMNcdZs"}'::jsonb
        when 'instagram' then existing.item || '{"url":"https://www.instagram.com/gdg_sru/"}'::jsonb
        when 'x' then existing.item || '{"url":"https://x.com/gdgsru"}'::jsonb
        when 'github' then existing.item || '{"url":"https://github.com/gdgsru"}'::jsonb
        else existing.item
      end,
      existing.ord
    from existing
  ),
  missing(item, ord) as (
    select defaults.item, 1000 + coalesce((defaults.item->>'sort_order')::integer, 0)
    from defaults
    where not exists (
      select 1 from existing where existing.item->>'key' = defaults.item->>'key'
    )
  ),
  all_items as (
    select item, ord from patched
    union all
    select item, ord from missing
  )
  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from all_items
)
where s.key = 'social_links';

insert into public.site_settings(key, value) values
  ('contact_email', '"gdg@sru.edu.in"'::jsonb),
  ('secondary_contact_email', '"gdgoncamps.sru@gmail.com"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

commit;
