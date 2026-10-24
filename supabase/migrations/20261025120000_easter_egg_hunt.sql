-- Easter egg hunt (launch day).
-- Rules and countdown are public and editable in Mission Control.
-- Participant names and points stay private to admins.
-- Only wheel numbers are exposed publicly, through a view.

begin;

-- 1. Settings (one row) -------------------------------------------------------
create table if not exists public.easter_egg_settings (
  id                smallint primary key default 1 check (id = 1),
  rules_text        text        not null default '',
  countdown_title   text        not null default 'Hunt ends in',
  countdown_ends_at timestamptz,
  countdown_enabled boolean     not null default false,
  updated_at        timestamptz not null default now()
);

insert into public.easter_egg_settings (id) values (1)
  on conflict (id) do nothing;

-- 2. Participants (manual entry by admins) ------------------------------------
create table if not exists public.easter_egg_participants (
  id             uuid primary key default gen_random_uuid(),
  roll_number    text        not null unique,
  full_name      text        not null,
  hunt_points    integer     not null default 0 check (hunt_points >= 0),
  wheel_entrant  boolean     not null default false,
  wheel_number   integer     unique check (wheel_number between 1 and 999),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint wheel_number_needs_entrant
    check (wheel_number is null or wheel_entrant)
);

-- 3. Prizes (entered by admins, normally three) -------------------------------
create table if not exists public.easter_egg_prizes (
  id            uuid primary key default gen_random_uuid(),
  position      integer     not null default 0,
  title         text        not null,
  status        text        not null default 'available'
                check (status in ('available', 'won')),
  won_by_number integer,
  won_at        timestamptz,
  created_at    timestamptz not null default now()
);

-- 4. Row Level Security -------------------------------------------------------
alter table public.easter_egg_settings     enable row level security;
alter table public.easter_egg_participants enable row level security;
alter table public.easter_egg_prizes       enable row level security;

-- Settings: anyone can read the rules and countdown; only admins write.
drop policy if exists ees_public_read on public.easter_egg_settings;
create policy ees_public_read on public.easter_egg_settings
  for select to anon, authenticated using (true);

drop policy if exists ees_admin on public.easter_egg_settings;
create policy ees_admin on public.easter_egg_settings
  for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- Prizes: anyone can read (the wheel shows prize names); only admins write.
drop policy if exists eep_public_read on public.easter_egg_prizes;
create policy eep_public_read on public.easter_egg_prizes
  for select to anon, authenticated using (true);

drop policy if exists eep_admin on public.easter_egg_prizes;
create policy eep_admin on public.easter_egg_prizes
  for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- Participants: admins only. Names and points never reach the public.
drop policy if exists eepar_admin on public.easter_egg_participants;
create policy eepar_admin on public.easter_egg_participants
  for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- 5. Public view: wheel numbers only (no names, no points) --------------------
-- The view runs with its owner's rights so it can read the private table,
-- but it exposes only the wheel numbers of entrants.
drop view if exists public.easter_egg_wheel_numbers;
create view public.easter_egg_wheel_numbers as
  select wheel_number
  from public.easter_egg_participants
  where wheel_entrant and wheel_number is not null
  order by wheel_number;

grant select on public.easter_egg_wheel_numbers to anon, authenticated;

commit;
