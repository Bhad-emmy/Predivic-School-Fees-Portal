-- Payment Recorder MVP
--
-- Payments remain the source of truth for amounts received.  A receipt is a
-- durable, one-to-one record generated in the same transaction as its payment.

create sequence if not exists public.payment_receipt_number_seq;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  receipt_number text not null unique,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists receipts_student_id_idx
  on public.receipts(student_id);

alter table public.receipts enable row level security;

-- Existing code used Paid, Successful, and Completed interchangeably.  Keep
-- historical data valid while using completed for all new recorder payments.
update public.payments
set status = 'completed'
where lower(coalesce(status, '')) in ('paid', 'successful', 'completed');

alter table public.payments
  alter column status set default 'completed';

-- The Express API uses this function with its service-role client.  It makes
-- validation, balance calculation, payment persistence, and receipt creation
-- a single transaction so concurrent requests cannot overpay an account.
create or replace function public.record_payment(
  p_student_id uuid,
  p_student_fee_account_id uuid,
  p_amount numeric,
  p_method text,
  p_payment_date date,
  p_notes text default null,
  p_reference text default null
)
returns table (
  payment_id uuid,
  receipt_number text,
  total_paid numeric,
  balance numeric,
  account_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_account record;
  v_existing_paid numeric := 0;
  v_total_paid numeric := 0;
  v_balance numeric := 0;
  v_payment_id uuid;
  v_receipt_number text;
  v_account_status text;
begin
  if p_student_id is null or p_student_fee_account_id is null then
    raise exception 'Student and student fee account are required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if nullif(btrim(coalesce(p_method, '')), '') is null then
    raise exception 'Payment method is required.';
  end if;

  select
    sfa.id,
    sfa.student_id,
    sfa.fee_account_id,
    coalesce(sfa.total_amount, fa.total_amount, 0) as total_amount
  into v_account
  from public.student_fee_accounts sfa
  left join public.fee_accounts fa on fa.id = sfa.fee_account_id
  where sfa.id = p_student_fee_account_id
  for update of sfa;

  if not found then
    raise exception 'Student fee account not found.';
  end if;

  if v_account.student_id <> p_student_id then
    raise exception 'The selected fee account does not belong to this student.';
  end if;

  select coalesce(sum(amount), 0)
  into v_existing_paid
  from public.payments
  where student_fee_account_id = p_student_fee_account_id
    and lower(coalesce(status, '')) in ('paid', 'successful', 'completed');

  if p_amount > (v_account.total_amount - v_existing_paid) then
    raise exception 'Payment exceeds the outstanding balance.';
  end if;

  insert into public.payments (
    student_id,
    fee_account_id,
    student_fee_account_id,
    amount,
    payment_date,
    method,
    reference,
    status,
    notes
  )
  values (
    p_student_id,
    v_account.fee_account_id,
    p_student_fee_account_id,
    p_amount,
    coalesce(p_payment_date, current_date),
    btrim(p_method),
    nullif(btrim(coalesce(p_reference, '')), ''),
    'completed',
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_payment_id;

  v_total_paid := v_existing_paid + p_amount;
  v_balance := v_account.total_amount - v_total_paid;
  v_account_status := case
    when v_balance <= 0 then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'outstanding'
  end;

  update public.student_fee_accounts
  set status = v_account_status,
      updated_at = now()
  where id = p_student_fee_account_id;

  v_receipt_number := format(
    'REC-%s-%s',
    to_char(coalesce(p_payment_date, current_date), 'YYYY'),
    lpad(nextval('public.payment_receipt_number_seq')::text, 6, '0')
  );

  insert into public.receipts (
    payment_id,
    student_id,
    receipt_number
  )
  values (
    v_payment_id,
    p_student_id,
    v_receipt_number
  );

  return query
  select
    v_payment_id,
    v_receipt_number,
    v_total_paid,
    v_balance,
    v_account_status;
end;
$$;

revoke all on function public.record_payment(uuid, uuid, numeric, text, date, text, text) from public;
grant execute on function public.record_payment(uuid, uuid, numeric, text, date, text, text) to service_role;
