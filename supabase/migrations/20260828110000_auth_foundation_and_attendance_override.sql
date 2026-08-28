-- Authentication foundation and attendance override authorization.
-- Staff identity and role are intentionally kept in public.teachers.

alter table public.teachers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists teachers_auth_user_id_unique
  on public.teachers (auth_user_id)
  where auth_user_id is not null;

alter table public.audit_logs
  add column if not exists reason text;

-- These helpers derive authorization from the authenticated Supabase user,
-- never from a frontend-provided role.
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select t.role
  from public.teachers t
  where t.auth_user_id = auth.uid()
    and lower(coalesce(t.status, '')) = 'active'
  limit 1;
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.current_staff_role() is not null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select lower(coalesce(public.current_staff_role(), '')) = 'admin';
$$;

create or replace function public.can_record_student_attendance()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select lower(coalesce(public.current_staff_role(), '')) in ('admin', 'teacher');
$$;

revoke all on function public.current_staff_role() from public;
revoke all on function public.is_active_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_record_student_attendance() from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_record_student_attendance() to authenticated;

-- Replace only policies on the three tables this feature secures. This avoids
-- a permissive legacy policy silently defeating the authorization boundary.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'teachers',
        'student_attendance',
        'audit_logs',
        'students',
        'student_enrollments',
        'classes',
        'academic_sessions',
        'terms',
        'school_calendar_exclusions'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

alter table public.teachers enable row level security;
alter table public.student_attendance enable row level security;
alter table public.audit_logs enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.classes enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.terms enable row level security;
alter table public.school_calendar_exclusions enable row level security;

create policy "staff_can_read_own_teacher_record"
  on public.teachers
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "active_staff_can_read_student_attendance"
  on public.student_attendance
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_students"
  on public.students
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_student_enrollments"
  on public.student_enrollments
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_classes"
  on public.classes
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_academic_sessions"
  on public.academic_sessions
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_terms"
  on public.terms
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "active_staff_can_read_school_calendar_exclusions"
  on public.school_calendar_exclusions
  for select
  to authenticated
  using ((select public.is_active_staff()));

create policy "teachers_and_admins_can_insert_student_attendance"
  on public.student_attendance
  for insert
  to authenticated
  with check ((select public.can_record_student_attendance()));

-- No direct UPDATE or DELETE policy exists. Saved records remain locked for
-- every role; the audited Admin-only RPC below is the only override path.

create policy "admins_can_read_attendance_audit_logs"
  on public.audit_logs
  for select
  to authenticated
  using ((select public.is_admin()));

create or replace function public.override_student_attendance(
  p_attendance_id uuid,
  p_new_status text,
  p_reason text
)
returns public.student_attendance
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  previous_attendance public.student_attendance%rowtype;
  updated_attendance public.student_attendance%rowtype;
  normalized_status text;
  normalized_reason text;
begin
  if not public.is_admin() then
    raise exception 'Only an active Admin may override saved student attendance'
      using errcode = '42501';
  end if;

  normalized_status := initcap(lower(trim(coalesce(p_new_status, ''))));
  normalized_reason := nullif(trim(coalesce(p_reason, '')), '');

  if normalized_status not in ('Present', 'Absent') then
    raise exception 'Attendance override status must be Present or Absent'
      using errcode = '22023';
  end if;

  if normalized_reason is null then
    raise exception 'An attendance override reason is required'
      using errcode = '22023';
  end if;

  select *
  into previous_attendance
  from public.student_attendance
  where id = p_attendance_id
  for update;

  if not found then
    raise exception 'Attendance record not found'
      using errcode = 'P0002';
  end if;

  if lower(previous_attendance.status) = lower(normalized_status) then
    raise exception 'The override status must differ from the saved status'
      using errcode = '22023';
  end if;

  update public.student_attendance
  set status = normalized_status
  where id = previous_attendance.id
  returning * into updated_attendance;

  insert into public.audit_logs (
    actor_user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    reason
  ) values (
    auth.uid(),
    'attendance_override',
    'student_attendance',
    updated_attendance.id,
    to_jsonb(previous_attendance),
    to_jsonb(updated_attendance),
    normalized_reason
  );

  return updated_attendance;
end;
$$;

revoke all on function public.override_student_attendance(uuid, text, text) from public;
grant execute on function public.override_student_attendance(uuid, text, text) to authenticated;
