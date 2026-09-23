-- Shared teacher attendance account: attendance-only authorization boundary.
-- The shared account is represented as a staff row with role = 'Attendance'.
-- Its auth_user_id must be linked after the Supabase Auth user is created.

create or replace function public.is_attendance_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select lower(coalesce(public.current_staff_role(), '')) = 'attendance';
$$;

create or replace function public.can_record_student_attendance()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select lower(coalesce(public.current_staff_role(), '')) in ('admin', 'teacher', 'secretary', 'attendance');
$$;

create or replace function public.can_access_student_attendance_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(public.current_staff_role(), ''))
    when 'admin' then exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.school_id = (select private.current_staff_school_id())
    )
    when 'secretary' then exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.school_id = (select private.current_staff_school_id())
    )
    when 'teacher' then exists (
      select 1
      from public.teacher_class_assignments tca
      join public.teachers t on t.id = tca.teacher_id
      join public.classes c on c.id = tca.class_id
      where tca.class_id = p_class_id
        and t.auth_user_id = (select auth.uid())
        and t.status = 'Active'
        and t.school_id = (select private.current_staff_school_id())
        and c.school_id = (select private.current_staff_school_id())
    )
    when 'attendance' then exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.school_id = (select private.current_staff_school_id())
    )
    else false
  end;
$$;

revoke all on function public.is_attendance_staff() from public;
grant execute on function public.is_attendance_staff() to authenticated;

-- Existing broad school-scoped management policies must not grant the
-- shared attendance account access to non-attendance modules.
do $$
declare
  p record;
  policy_sql text;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'authenticated users can manage admissions',
        'authenticated users can manage classes',
        'authenticated users can manage guardians',
        'authenticated users can manage payments',
        'authenticated users can manage receipts',
        'authenticated users can manage school calendar exclusions',
        'authenticated users can manage student enrollments',
        'authenticated users can manage student fee accounts',
        'authenticated users can manage students',
        'authenticated users can manage teacher attendance'
      )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);

    policy_sql := format(
      'create policy %I on public.%I for all to authenticated using ((school_id = (select private.current_staff_school_id())) and (lower(coalesce(public.current_staff_role(), '''')) <> ''attendance'')) with check ((school_id = (select private.current_staff_school_id())) and (lower(coalesce(public.current_staff_role(), '''')) <> ''attendance''))',
      p.policyname,
      p.tablename
    );

    execute policy_sql;
  end loop;
end;
$$;

-- Attendance needs read-only access to classes, enrollments and students.
create policy "attendance staff can read classes"
  on public.classes
  for select
  to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and public.is_attendance_staff()
  );

create policy "attendance staff can read student enrollments"
  on public.student_enrollments
  for select
  to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and public.is_attendance_staff()
  );

create policy "attendance staff can read students"
  on public.students
  for select
  to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and public.is_attendance_staff()
  );

-- Remove attendance access to financial/configuration reads.
drop policy if exists "authenticated staff can read fee accounts" on public.fee_accounts;
create policy "authenticated staff can read fee accounts"
  on public.fee_accounts
  for select
  to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and not public.is_attendance_staff()
  );

drop policy if exists "authenticated staff can read fee items" on public.fee_items;
create policy "authenticated staff can read fee items"
  on public.fee_items
  for select
  to authenticated
  using (
    (select is_active_staff())
    and not public.is_attendance_staff()
    and exists (
      select 1
      from public.fee_accounts fa
      where fa.id = fee_items.fee_account_id
        and fa.school_id = (select private.current_staff_school_id())
    )
  );

drop policy if exists "active_staff_can_read_school_settings" on public.school_settings;
create policy "active_staff_can_read_school_settings"
  on public.school_settings
  for select
  to authenticated
  using (
    (select is_active_staff())
    and not public.is_attendance_staff()
    and school_id = (select private.current_staff_school_id())
  );

drop policy if exists "active staff can read own school" on public.schools;
create policy "active staff can read own school"
  on public.schools
  for select
  to authenticated
  using (
    id = (select private.current_staff_school_id())
    and not public.is_attendance_staff()
  );

-- Student attendance remains the only writable school data available to
-- the shared attendance role.
drop policy if exists "authenticated staff can read student attendance" on public.student_attendance;
create policy "authenticated staff can read student attendance"
  on public.student_attendance
  for select
  to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and (select can_access_student_attendance_class(student_attendance.class_id))
  );

drop policy if exists "staff can insert student attendance" on public.student_attendance;
create policy "staff can insert student attendance"
  on public.student_attendance
  for insert
  to authenticated
  with check (
    school_id = (select private.current_staff_school_id())
    and (select can_record_student_attendance())
    and (select can_access_student_attendance_class(student_attendance.class_id))
  );
