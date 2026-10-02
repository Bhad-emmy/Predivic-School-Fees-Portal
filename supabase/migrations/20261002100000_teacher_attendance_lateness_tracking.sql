-- Teacher attendance lateness tracking for clock-machine sign-in records.
-- Stores derived minutes late for payroll/reporting.

alter table public.teacher_attendance
  add column if not exists late_minutes integer;

alter table public.teacher_attendance
  drop constraint if exists teacher_attendance_late_minutes_check;

alter table public.teacher_attendance
  add constraint teacher_attendance_late_minutes_check
  check (late_minutes is null or late_minutes >= 0);

update public.teacher_attendance
set late_minutes = greatest(
  0,
  floor(extract(epoch from (check_in - time '08:00:00')) / 60)::integer
)
where check_in is not null
  and check_in > time '08:00:00';

update public.teacher_attendance
set late_minutes = 0
where check_in is not null
  and check_in <= time '08:00:00';

create index if not exists teacher_attendance_teacher_date_idx
  on public.teacher_attendance (teacher_id, attendance_date);
