-- Fix public SELECT policy on blog_series
-- anon role does not have execute privileges on private.is_admin(), which causes
-- PostgreSQL error 42501 (permission denied for function is_admin) when evaluating
-- (status = 'published' or private.is_admin()).
-- Anonymous visitors only need to view published series.

drop policy if exists blog_series_public_read on public.blog_series;
create policy blog_series_public_read on public.blog_series for select to anon, authenticated
  using (status = 'published');
