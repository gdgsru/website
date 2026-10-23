-- One-time cleanup for the 2026-27 team: department renames, merging Program Coordination
-- into Program Operations, and removing Shrivardhan Reddy.
--
-- The starting order (and each person's department, role and name) is applied ONCE, guarded
-- by a settings flag. After that, the order is owned by Mission Control, so admin changes
-- are never overwritten by re-running this file.

-- 1. Renames and merges (names only; idempotent) --------------------------------------------
update public.team_departments set name = 'Chapter Leadership', heading = 'Chapter Leadership'
  where slug = 'leadership' and name <> 'Chapter Leadership';
update public.team_departments set name = 'Design & Branding', heading = 'Design & Branding'
  where slug = 'design-media' and name <> 'Design & Branding';
update public.team_members set department = 'Program Operations' where department = 'Program Coordination';
delete from public.team_departments where slug = 'program-coordination';
update public.team_members set department = 'Chapter Leadership' where department in ('Executive', 'Executive Board');
update public.team_members set department = 'Design & Branding' where department = 'Design & Media';

-- Shrivardhan Reddy is no longer on the team. Removing the row also removes him from the site.
delete from public.team_members where lower(member_code) = '26-adv-03';

-- 2. Starting order, applied once ------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.site_settings where key = 'team_order_2026_27_applied') then
    return;
  end if;

  -- Existing rows created before member codes existed get their code from the name they were imported with.
  -- Only rows with no code are touched; the names below are the ones the live roster uses.
  update public.team_members m set member_code = v.code
  from (values
    ('26-EXE-01', 'Narayan Bora'), ('26-EXE-02', 'Manchena Keerthana'), ('26-EXE-02', 'Keerthana Manchena'),
    ('26-EXE-03', 'Suram Varshini'), ('26-TCH-01', 'Uttam Chaurasia'), ('26-TCH-02', 'Vydya Varshith'),
    ('26-TCH-03', 'Gaurav Kumar'), ('26-TCH-04', 'Govinda Sharma'), ('26-OPS-01', 'Kattekola Rahul'),
    ('26-OPS-02', 'Bhargav Sai'), ('26-OPS-03', 'Ankit Kumar'), ('26-OPS-04', 'Shivshakti Kumar'),
    ('26-OUT-01', 'Gagan Raj Nagi'), ('26-OUT-02', 'Sandhya Kumari'), ('26-RES-01', 'Shivank Pandey'),
    ('26-RES-02', 'Mohit Jalan'), ('26-DSN-01', 'Eshwari Khose'), ('26-DSN-02', 'Sharvari Panchal'),
    ('26-ADV-01', 'Dr. Siddhartha Bhattacharyya')
  ) as v(code, name)
  where m.member_code = '' and lower(btrim(m.name)) = lower(btrim(v.name));

  update public.team_departments set sort_order = v.so
  from (values
    ('leadership', 10), ('advisory', 20), ('technical-programs', 30), ('program-operations', 40),
    ('outreach-pr', 50), ('research-publications', 60), ('design-media', 70)
  ) as v(slug, so)
  where public.team_departments.slug = v.slug;

  update public.team_members m set name = v.name, role = v.role, department = v.dept, sort_order = v.so
  from (values
    ('26-EXE-01', 'Narayan Bora', 'Lead Organizer', 'Chapter Leadership', 1),
    ('26-EXE-02', 'Keerthana Manchena', 'Co-Organizer', 'Chapter Leadership', 2),
    ('26-EXE-03', 'Suram Varshini', 'Co-Organizer', 'Chapter Leadership', 3),
    ('26-ADV-01', 'Dr. Siddhartha Bhattacharyya', 'Faculty Advisor', 'Advisory Board', 4),
    ('26-TCH-01', 'Uttam Chaurasia', 'Tech Lead', 'Technical Programs', 5),
    ('26-TCH-02', 'Vydya Varshith', 'AI & Cloud Associate', 'Technical Programs', 6),
    ('26-TCH-03', 'Gaurav Kumar', 'Web Associate', 'Technical Programs', 7),
    ('26-TCH-04', 'Govinda Sharma', 'Data & ML Associate', 'Technical Programs', 8),
    ('26-OPS-01', 'Kattekola Rahul', 'Program Lead', 'Program Operations', 9),
    ('26-OPS-02', 'Bhargav Sai', 'Operations Associate', 'Program Operations', 10),
    ('26-OPS-04', 'Shivshakti Kumar', 'Program Coordinator', 'Program Operations', 11),
    ('26-OPS-03', 'Ankit Kumar', 'Program Coordinator', 'Program Operations', 12),
    ('26-OUT-01', 'Gagan Raj Nagi', 'Outreach & PR Lead', 'Outreach & PR', 13),
    ('26-OUT-02', 'Sandhya Kumari', 'Outreach Associate', 'Outreach & PR', 14),
    ('26-RES-01', 'Shivank Pandey', 'Head of Research & Publication', 'Research & Publications', 15),
    ('26-RES-02', 'Mohit Jalan', 'Editorial Associate', 'Research & Publications', 16),
    ('26-DSN-01', 'Eshwari Khose', 'Design Lead', 'Design & Branding', 17),
    ('26-DSN-02', 'Sharvari Panchal', 'Media Associate', 'Design & Branding', 18)
  ) as v(code, name, role, dept, so)
  where lower(m.member_code) = lower(v.code);

  update public.team_members set leadership_order = 100;

  insert into public.site_settings (key, value) values ('team_order_2026_27_applied', 'true'::jsonb);
end $$;
