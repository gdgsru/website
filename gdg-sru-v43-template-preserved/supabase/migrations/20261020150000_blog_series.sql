-- Blog series are managed in Mission Control, not fixed in the code.
-- Each post can belong to one series. Series are shown on the blog page when published.
-- Safe to run more than once.

create table if not exists public.blog_series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  description text not null default '' check (char_length(description) <= 300),
  color text not null default 'b' check (color in ('b', 'g', 'y', 'r')),
  status text not null default 'published' check (status in ('published', 'draft', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_entries add column if not exists series_id uuid references public.blog_series(id) on delete set null;
create index if not exists blog_entries_series_idx on public.blog_entries(series_id);

alter table public.blog_series enable row level security;

drop policy if exists blog_series_public_read on public.blog_series;
create policy blog_series_public_read on public.blog_series for select to anon, authenticated
  using (status = 'published');

drop policy if exists blog_series_admin_write on public.blog_series;
create policy blog_series_admin_write on public.blog_series for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

revoke all on public.blog_series from anon;
grant select on public.blog_series to anon;
grant select, insert, update, delete on public.blog_series to authenticated;

-- No series are created here. Add your own from Mission Control.
