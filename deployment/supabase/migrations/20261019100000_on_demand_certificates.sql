-- On-demand certificates.
--
-- Certificates are no longer stored. A visitor picks an event and types their name; if the name is in
-- that event's uploaded attendance list (attendance_records, status 'attended') the browser renders the
-- certificate right then from the active template + the event's certificate settings.
--
-- The credential ID printed on a certificate is derived (salted hash of event + normalised name), so
-- /verify can re-check it from the attendance list without any stored certificate.
--
-- DESTRUCTIVE: drops public.certificates, public.certificate_claim_challenges,
-- public.certificate_download_tokens and the old issue/download RPCs. Nothing in the current project
-- depends on them (the email-code flow and Edge Functions were never deployed). Review before applying.

begin;

-- ---------------------------------------------------------------- private helpers
create schema if not exists private;

create table if not exists private.certificate_secret (
  id boolean primary key default true check (id),
  salt text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into private.certificate_secret default values on conflict (id) do nothing;
revoke all on private.certificate_secret from public, anon, authenticated;

-- "  Asha   RAO " -> "asha rao"
create or replace function private.norm_name(p text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

create or replace function private.credential_for(p_event uuid, p_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select 'GDGSRU-' || upper(left(md5(s.salt || '|' || p_event::text || '|' || private.norm_name(p_name)), 12))
  from private.certificate_secret s
$$;
revoke all on function private.norm_name(text) from public, anon, authenticated;
revoke all on function private.credential_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- per-event certificate settings
create table if not exists public.certificate_configs (
  event_id uuid primary key references public.events(id) on delete cascade,
  enabled boolean not null default false,
  template_id uuid references public.certificate_templates(id) on delete set null,
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) < 200000),
  updated_at timestamptz not null default now()
);
create index if not exists certificate_configs_template_idx on public.certificate_configs(template_id);
alter table public.certificate_configs enable row level security;
drop policy if exists certificate_configs_admin_all on public.certificate_configs;
create policy certificate_configs_admin_all on public.certificate_configs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
revoke all on public.certificate_configs from anon;
grant select, insert, update, delete on public.certificate_configs to authenticated;

create index if not exists attendance_event_status_idx on public.attendance_records(event_id, attendance_status);

-- ---------------------------------------------------------------- public RPCs
-- Events a visitor may claim a certificate for (enabled + at least one attended record). No names exposed.
create or replace function public.list_certificate_events()
returns table(id uuid, title text, start_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.start_at
  from public.events e
  join public.certificate_configs c on c.event_id = e.id and c.enabled
  where exists (select 1 from public.attendance_records a where a.event_id = e.id and a.attendance_status = 'attended')
  order by e.start_at desc nulls last
$$;
revoke all on function public.list_certificate_events() from public;
grant execute on function public.list_certificate_events() to anon, authenticated;

-- Returns one JSON object when (event, name) matches an attended record, else NULL.
-- Exact match after trimming, collapsing spaces and ignoring case. Nothing else about the list is exposed.
create or replace function public.claim_certificate(p_event_id uuid, p_name text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  n text := private.norm_name(p_name);
  a public.attendance_records%rowtype;
  e public.events%rowtype;
  c public.certificate_configs%rowtype;
  t_html text;
begin
  if p_event_id is null or char_length(n) < 3 or char_length(n) > 120 then return null; end if;
  select * into c from public.certificate_configs where event_id = p_event_id and enabled;
  if not found then return null; end if;
  select * into a from public.attendance_records
    where event_id = p_event_id and attendance_status = 'attended' and private.norm_name(attendee_name) = n
    order by imported_at limit 1;
  if not found then return null; end if;
  select * into e from public.events where id = p_event_id;
  select html_template into t_html from public.certificate_templates
    where id = coalesce(c.template_id, (select id from public.certificate_templates where is_active limit 1));
  if t_html is null then return null; end if;
  return jsonb_build_object(
    'recipient_name', regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'),
    'credential_id', private.credential_for(p_event_id, a.attendee_name),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', c.fields,
    'template_html', t_html
  );
end $$;
revoke all on function public.claim_certificate(uuid, text) from public;
grant execute on function public.claim_certificate(uuid, text) to anon, authenticated;

-- /verify: recompute credential IDs from the attendance list. Returns only name, event and status.
drop function if exists public.verify_certificate(text);
create function public.verify_certificate(p_code text)
returns table(recipient_name text, event_title text, status text)
language sql stable security definer set search_path = public
as $$
  select regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'), e.title, 'verified'::text
  from public.attendance_records a
  join public.events e on e.id = a.event_id
  join public.certificate_configs c on c.event_id = a.event_id and c.enabled
  where a.attendance_status = 'attended'
    and char_length(btrim(coalesce(p_code, ''))) between 10 and 40
    and private.credential_for(a.event_id, a.attendee_name) = upper(btrim(p_code))
  limit 1
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------- remove the stored-certificate system
drop function if exists public.issue_certificate_for_attendance(uuid, uuid);
drop function if exists public.mark_certificate_downloaded(text, text);
drop table if exists public.certificate_download_tokens;
drop table if exists public.certificate_claim_challenges;
drop table if exists public.certificates;

commit;
