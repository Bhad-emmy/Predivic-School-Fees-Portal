-- MEKA School security hardening: enforce staff roles at the database boundary.
-- No student, payment, receipt, or school data is deleted or transformed.

drop policy if exists "authenticated users can manage students" on public.students;
create policy "admin and secretary can manage students"
on public.students for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
)
with check (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated users can manage student enrollments" on public.student_enrollments;
create policy "admin and secretary can manage student enrollments"
on public.student_enrollments for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
)
with check (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated users can manage guardians" on public.guardians;
create policy "admin and secretary can manage guardians"
on public.guardians for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
)
with check (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated users can manage admissions" on public.admissions;
create policy "admin and secretary can manage admissions"
on public.admissions for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
)
with check (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated users can manage student fee accounts" on public.student_fee_accounts;
create policy "admin and secretary can manage student fee accounts"
on public.student_fee_accounts for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
)
with check (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated staff can read fee accounts" on public.fee_accounts;
create policy "admin and secretary can read fee accounts"
on public.fee_accounts for select to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated staff can read fee items" on public.fee_items;
create policy "admin and secretary can read fee items"
on public.fee_items for select to authenticated
using (
  exists (
    select 1 from public.fee_accounts fa
    where fa.id = fee_items.fee_account_id
      and fa.school_id = (select private.current_staff_school_id())
      and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
  )
);

drop policy if exists "authenticated users can manage classes" on public.classes;
create policy "admins can manage classes"
on public.classes for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and (select public.is_admin())
)
with check (
  school_id = (select private.current_staff_school_id())
  and (select public.is_admin())
);

drop policy if exists "authenticated users can manage school calendar exclusions" on public.school_calendar_exclusions;
create policy "admins can manage school calendar exclusions"
on public.school_calendar_exclusions for all to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and (select public.is_admin())
)
with check (
  school_id = (select private.current_staff_school_id())
  and (select public.is_admin())
);

drop policy if exists "authenticated users can manage payments" on public.payments;
create policy "admin and secretary can read payments"
on public.payments for select to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);

drop policy if exists "authenticated users can manage receipts" on public.receipts;
create policy "admin and secretary can read receipts"
on public.receipts for select to authenticated
using (
  school_id = (select private.current_staff_school_id())
  and lower(coalesce(public.current_staff_role(), '')) in ('admin','secretary')
);
