-- Security hardening: private RLS helpers, payment-table isolation,
-- restricted privileged RPCs, per-school Paystack routing, and safer defaults.

create schema if not exists private;

create or replace function private.current_staff_role()
returns text language sql stable security definer set search_path = ''
as $$ select t.role from public.teachers t where t.auth_user_id=(select auth.uid()) and t.status='Active' limit 1 $$;

create or replace function private.is_active_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.teachers t where t.auth_user_id=(select auth.uid()) and t.status='Active') $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select private.current_staff_role())='Admin',false) $$;

create or replace function private.is_attendance_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select lower(coalesce((select private.current_staff_role()),''))='attendance' $$;

create or replace function private.can_read_student_attendance()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_active_staff() $$;

create or replace function private.can_record_student_attendance()
returns boolean language sql stable security definer set search_path = ''
as $$ select lower(coalesce((select private.current_staff_role()),'')) in ('admin','teacher','secretary','attendance') $$;

create or replace function private.can_access_student_attendance_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
select case lower(coalesce((select private.current_staff_role()),''))
when 'admin' then exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=(select private.current_staff_school_id()))
when 'secretary' then exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=(select private.current_staff_school_id()))
when 'teacher' then exists(
 select 1 from public.teacher_class_assignments tca
 join public.teachers t on t.id=tca.teacher_id
 join public.classes c on c.id=tca.class_id
 where tca.class_id=p_class_id and t.auth_user_id=(select auth.uid()) and t.status='Active'
 and t.school_id=(select private.current_staff_school_id()) and c.school_id=(select private.current_staff_school_id())
)
when 'attendance' then exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=(select private.current_staff_school_id()))
else false end
$$;

create or replace function public.current_staff_role()
returns text language sql stable security invoker set search_path = ''
as $$ select private.current_staff_role() $$;
create or replace function public.is_active_staff()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_active_staff() $$;
create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin() $$;
create or replace function public.is_attendance_staff()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_attendance_staff() $$;
create or replace function public.can_read_student_attendance()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_read_student_attendance() $$;
create or replace function public.can_record_student_attendance()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_record_student_attendance() $$;
create or replace function public.can_access_student_attendance_class(p_class_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_access_student_attendance_class(p_class_id) $$;

alter function public.record_payment(numeric,text,text,timestamptz,text,uuid,uuid) security invoker;
alter function public.record_payment(uuid,numeric,text,text,text) security invoker;
alter function public.register_new_student(jsonb,uuid) security invoker;
alter function public.override_student_attendance(uuid,text,text) security invoker;

revoke execute on function public.register_new_student(jsonb,uuid) from anon, public;
grant execute on function public.register_new_student(jsonb,uuid) to authenticated;

revoke all on table public.parent_payment_links from anon, authenticated;
revoke all on table public.payment_intents from anon, authenticated;
grant select on table public.parent_payment_links, public.payment_intents to authenticated;

drop policy if exists "staff can read own school parent payment links" on public.parent_payment_links;
create policy "staff can read own school parent payment links"
on public.parent_payment_links for select to authenticated
using (school_id=(select private.current_staff_school_id())
  and lower(coalesce((select private.current_staff_role()),'')) in ('admin','secretary'));

drop policy if exists "staff can read own school payment intents" on public.payment_intents;
create policy "staff can read own school payment intents"
on public.payment_intents for select to authenticated
using (school_id=(select private.current_staff_school_id())
  and lower(coalesce((select private.current_staff_role()),'')) in ('admin','secretary'));

alter table public.school_settings add column if not exists paystack_subaccount_code text;

update public.school_settings
set paystack_subaccount_code='ACCT_bj4k4vw46o1swi7'
where school_id=(select id from public.schools order by created_at limit 1)
and coalesce(paystack_subaccount_code,'')='';

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

grant usage on schema private to authenticated;
revoke execute on function private.current_staff_role() from public;
revoke execute on function private.is_active_staff() from public;
revoke execute on function private.is_admin() from public;
revoke execute on function private.is_attendance_staff() from public;
revoke execute on function private.can_read_student_attendance() from public;
revoke execute on function private.can_record_student_attendance() from public;
revoke execute on function private.can_access_student_attendance_class(uuid) from public;
grant execute on function private.current_staff_role() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_attendance_staff() to authenticated;
grant execute on function private.can_read_student_attendance() to authenticated;
grant execute on function private.can_record_student_attendance() to authenticated;
grant execute on function private.can_access_student_attendance_class(uuid) to authenticated;
