-- MEKA School Paystack V1
-- Test-first online fee collection foundation.
-- No live credentials or live transactions are stored here.

create table if not exists public.parent_payment_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  student_fee_account_id uuid not null references public.student_fee_accounts(id) on delete restrict,
  token_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists parent_payment_links_account_idx
  on public.parent_payment_links(student_fee_account_id);

create index if not exists parent_payment_links_school_idx
  on public.parent_payment_links(school_id);

alter table public.parent_payment_links enable row level security;

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  student_fee_account_id uuid not null references public.student_fee_accounts(id) on delete restrict,
  parent_payment_link_id uuid references public.parent_payment_links(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'NGN',
  reference text not null unique,
  paystack_reference text unique,
  paystack_access_code text,
  status text not null default 'pending'
    check (status in ('pending','paid','failed','abandoned','refunded')),
  paystack_transaction_id bigint,
  paystack_status text,
  paystack_channel text,
  gateway_response text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_school_idx
  on public.payment_intents(school_id);

create index if not exists payment_intents_account_idx
  on public.payment_intents(student_fee_account_id);

create index if not exists payment_intents_status_idx
  on public.payment_intents(status);

alter table public.payment_intents enable row level security;

-- The current production schema already carries school_id on payments/receipts.
-- Keep the migration safe for older local copies.
alter table public.payments
  add column if not exists school_id uuid references public.schools(id);

alter table public.receipts
  add column if not exists school_id uuid references public.schools(id);

update public.payments p
set school_id = sfa.school_id
from public.student_fee_accounts sfa
where p.student_fee_account_id = sfa.id
  and p.school_id is null;

update public.receipts r
set school_id = p.school_id
from public.payments p
where r.payment_id = p.id
  and r.school_id is null;

create or replace function public.finalize_paystack_payment(
  p_reference text,
  p_paystack_transaction_id bigint,
  p_amount_kobo bigint,
  p_currency text,
  p_paystack_status text,
  p_channel text,
  p_gateway_response text,
  p_paid_at timestamptz
)
returns table (
  payment_id uuid,
  receipt_number text,
  student_fee_account_id uuid,
  amount numeric,
  total_paid numeric,
  balance numeric,
  account_status text,
  already_finalized boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_account record;
  v_existing_paid numeric := 0;
  v_total_paid numeric := 0;
  v_balance numeric := 0;
  v_payment_id uuid;
  v_receipt_number text;
  v_account_status text;
  v_existing_payment_id uuid;
begin
  if nullif(btrim(coalesce(p_reference, '')), '') is null then
    raise exception 'Paystack reference is required.';
  end if;

  select pi.*
  into v_intent
  from public.payment_intents pi
  where pi.reference = p_reference
     or pi.paystack_reference = p_reference
  for update;

  if not found then
    raise exception 'Payment intent not found for reference.';
  end if;

  if v_intent.status = 'paid' and v_intent.paystack_transaction_id is not null then
    select p.id
    into v_existing_payment_id
    from public.payments p
    where p.reference = v_intent.reference
       or p.reference = v_intent.paystack_reference
    order by p.created_at desc
    limit 1;

    return query
    select
      v_existing_payment_id,
      r.receipt_number,
      v_intent.student_fee_account_id,
      v_intent.amount,
      coalesce(sum(p2.amount), 0),
      greatest(v_account.total_amount - coalesce(sum(p2.amount), 0), 0),
      case
        when v_account.total_amount - coalesce(sum(p2.amount), 0) <= 0 then 'paid'
        when coalesce(sum(p2.amount), 0) > 0 then 'partial'
        else 'outstanding'
      end,
      true
    from public.student_fee_accounts v_account
    left join public.payments p2
      on p2.student_fee_account_id = v_account.id
     and lower(coalesce(p2.status, '')) in ('paid','successful','completed')
    left join public.receipts r
      on r.payment_id = v_existing_payment_id
    where v_account.id = v_intent.student_fee_account_id
    group by v_account.id, v_account.total_amount, r.receipt_number;
    return;
  end if;

  if lower(coalesce(p_paystack_status, '')) <> 'success' then
    update public.payment_intents
    set status = case
      when lower(coalesce(p_paystack_status, '')) in ('failed','abandoned') then lower(p_paystack_status)
      else status
    end,
    paystack_status = p_paystack_status,
    updated_at = now()
    where id = v_intent.id;

    raise exception 'Paystack transaction is not successful.';
  end if;

  if upper(coalesce(p_currency, '')) <> 'NGN' then
    raise exception 'Unsupported Paystack currency.';
  end if;

  if p_amount_kobo is null or p_amount_kobo <> round(v_intent.amount * 100)::bigint then
    raise exception 'Paystack amount does not match the payment intent.';
  end if;

  select
    sfa.id,
    sfa.student_id,
    sfa.school_id,
    coalesce(sfa.total_amount, 0) as total_amount
  into v_account
  from public.student_fee_accounts sfa
  where sfa.id = v_intent.student_fee_account_id
    and sfa.student_id = v_intent.student_id
    and sfa.school_id = v_intent.school_id
  for update;

  if not found then
    raise exception 'Fee account does not match the payment intent school or student.';
  end if;

  select coalesce(sum(amount), 0)
  into v_existing_paid
  from public.payments
  where student_fee_account_id = v_account.id
    and lower(coalesce(status, '')) in ('paid','successful','completed');

  if v_intent.amount > (v_account.total_amount - v_existing_paid) then
    raise exception 'Paystack payment exceeds the outstanding balance.';
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
    notes,
    school_id
  )
  values (
    v_intent.student_id,
    (select fee_account_id from public.student_fee_accounts where id = v_account.id),
    v_account.id,
    v_intent.amount,
    coalesce(p_paid_at::date, current_date),
    'Online',
    v_intent.reference,
    'Paid',
    concat('Paystack transaction ', coalesce(p_paystack_transaction_id::text, 'unknown')),
    v_account.school_id
  )
  returning id into v_payment_id;

  v_total_paid := v_existing_paid + v_intent.amount;
  v_balance := greatest(v_account.total_amount - v_total_paid, 0);
  v_account_status := case
    when v_balance <= 0 then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'outstanding'
  end;

  update public.student_fee_accounts
  set status = v_account_status,
      updated_at = now()
  where id = v_account.id;

  v_receipt_number := format(
    'REC-%s-%s',
    to_char(coalesce(p_paid_at::date, current_date), 'YYYY'),
    lpad(nextval('public.payment_receipt_number_seq')::text, 6, '0')
  );

  insert into public.receipts (
    payment_id,
    student_id,
    receipt_number,
    issued_at,
    school_id
  )
  values (
    v_payment_id,
    v_intent.student_id,
    v_receipt_number,
    coalesce(p_paid_at, now()),
    v_account.school_id
  );

  update public.payment_intents
  set status = 'paid',
      paystack_reference = coalesce(paystack_reference, p_reference),
      paystack_transaction_id = p_paystack_transaction_id,
      paystack_status = p_paystack_status,
      paystack_channel = p_channel,
      gateway_response = p_gateway_response,
      paid_at = coalesce(p_paid_at, now()),
      updated_at = now()
  where id = v_intent.id;

  return query
  select
    v_payment_id,
    v_receipt_number,
    v_account.id,
    v_intent.amount,
    v_total_paid,
    v_balance,
    v_account_status,
    false;
end;
$$;

revoke all on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) from public;
revoke all on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) from authenticated;
grant execute on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) to service_role;
