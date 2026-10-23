begin;

alter table public.certificate_global_settings enable row level security;
alter table public.event_certificates          enable row level security;
alter table public.event_partners              enable row level security;
alter table public.credential_receipts         enable row level security;
alter table public.claim_attempts              enable row level security;   -- no policies: service role only
alter table public.cert_audit_log              enable row level security;

-- Attendance: remove every existing policy, then allow admins only.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'attendance_records' loop
    execute format('drop policy %I on public.attendance_records', p.policyname);
  end loop;
end $$;
alter table public.attendance_records enable row level security;

-- Admin full access
drop policy if exists cgs_admin on public.certificate_global_settings;
create policy cgs_admin on public.certificate_global_settings for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists ec_admin on public.event_certificates;
create policy ec_admin on public.event_certificates for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists ep_admin on public.event_partners;
create policy ep_admin on public.event_partners for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

drop policy if exists att_admin on public.attendance_records;
create policy att_admin on public.attendance_records for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- Receipts: admins can read and revoke/restore. No insert or delete from clients.
drop policy if exists receipts_admin_read on public.credential_receipts;
create policy receipts_admin_read on public.credential_receipts for select to authenticated
  using (public.is_org_admin());

drop policy if exists receipts_admin_status on public.credential_receipts;
create policy receipts_admin_status on public.credential_receipts for update to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- Audit log: admins read only. Rows are written by triggers.
drop policy if exists audit_admin_read on public.cert_audit_log;
create policy audit_admin_read on public.cert_audit_log for select to authenticated
  using (public.is_org_admin());

-- Ensure is_org_admin can be executed by authenticated admins
grant execute on function public.is_org_admin() to authenticated;

-- Storage: authenticated admins only for the private logo bucket.
drop policy if exists cert_logos_select on storage.objects;
drop policy if exists cert_logos_insert on storage.objects;
drop policy if exists cert_logos_update on storage.objects;
drop policy if exists cert_logos_delete on storage.objects;
drop policy if exists cert_logos_admin on storage.objects;

create policy cert_logos_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'certificate-logos')
  with check (bucket_id = 'certificate-logos');

commit;
