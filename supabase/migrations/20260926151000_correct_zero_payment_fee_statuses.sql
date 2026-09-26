-- Correct nine legacy fee-account statuses that were marked partial
-- despite having no recorded payments. Preserve all amounts and relationships.
update public.student_fee_accounts sfa
set status='outstanding',
    updated_at=now()
from public.students s
where sfa.student_id=s.id
  and s.school_id=s.school_id
  and s.admission_no in (
    'PRE2026290','PRE2026288','PRE2026286','PRE2026257',
    'PRE2026287','PRE2026271','PRE2026291','PRE2026293','PRE2026292'
  )
  and sfa.status='partial'
  and not exists (
    select 1 from public.payments p
    where p.student_fee_account_id=sfa.id
  );
