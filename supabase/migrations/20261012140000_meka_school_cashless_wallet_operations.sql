-- MEKA School Cashless: secure wallet operations.
-- Physical canteen only. No products, inventory, school-fees or Paystack integration.
-- Apply through reviewed migration; do not enable real transactions until end-to-end tests pass.

begin;

create table if not exists public.cashless_operator_access (
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  operator_role text not null check (operator_role = 'cashier'),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id, user_id)
);

alter table public.cashless_operator_access enable row level security;
revoke all on public.cashless_operator_access from anon, authenticated;

create or replace function private.cashless_is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.current_staff_school_id() = p_school_id
    and lower(coalesce(public.current_staff_role(), '')) in ('admin', 'secretary');
$$;

create or replace function private.cashless_can_operate(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.schools s
      where s.id = p_school_id and lower(coalesce(s.status::text, '')) = 'active'
    )
    and (
      private.cashless_is_school_admin(p_school_id)
      or exists (
        select 1 from public.cashless_operator_access a
        where a.school_id = p_school_id
          and a.user_id = auth.uid()
          and a.operator_role = 'cashier'
          and a.is_active
      )
    );
$$;

create or replace function public.cashless_set_cashier(
  p_user_id uuid,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_school_id := private.current_staff_school_id();
  if v_school_id is null or not private.cashless_is_school_admin(v_school_id) then
    raise exception 'Only an authorized school admin or secretary can manage cashiers'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Cashier user does not exist' using errcode = '22023';
  end if;

  insert into public.cashless_operator_access
    (school_id, user_id, operator_role, is_active, created_by, updated_at)
  values
    (v_school_id, p_user_id, 'cashier', p_is_active, auth.uid(), now())
  on conflict (school_id, user_id) do update
    set is_active = excluded.is_active, updated_at = now();
end;
$$;

create or replace function public.cashless_create_wallet(p_student_id uuid)
returns table (wallet_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_token text;
  v_wallet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_school_id := private.current_staff_school_id();
  if v_school_id is null or not private.cashless_is_school_admin(v_school_id) then
    raise exception 'Only an authorized school admin or secretary can create wallets'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.school_id = v_school_id
  ) then
    raise exception 'Student not found in your school' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.cashless_wallets w
    where w.school_id = v_school_id and w.student_id = p_student_id
  ) then
    raise exception 'A wallet already exists for this student; use the wallet recovery process'
      using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.cashless_wallets (school_id, student_id, qr_token_hash)
  values (v_school_id, p_student_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning id into v_wallet_id;

  return query select v_wallet_id, v_token;
end;
$$;

create or replace function public.cashless_resolve_qr(p_qr_token text)
returns table (
  wallet_id uuid,
  student_name text,
  admission_no text,
  balance_kobo bigint,
  wallet_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_qr_token is null or length(p_qr_token) < 32 or length(p_qr_token) > 256 then
    raise exception 'Invalid QR token' using errcode = '22023';
  end if;

  return query
  select w.id, concat_ws(' ', s.first_name, s.last_name), s.admission_no,
         w.balance_kobo, w.status
  from public.cashless_wallets w
  join public.students s on s.id = w.student_id and s.school_id = w.school_id
  where w.qr_token_hash = encode(extensions.digest(p_qr_token, 'sha256'), 'hex')
    and private.cashless_can_operate(w.school_id);

  if not found then
    raise exception 'Wallet not found or access denied' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.cashless_top_up(
  p_wallet_id uuid,
  p_amount_kobo bigint,
  p_idempotency_key text,
  p_reference text default null,
  p_note text default null
)
returns table (transaction_id uuid, balance_after_kobo bigint, was_duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_wallet public.cashless_wallets%rowtype;
  v_existing public.cashless_transactions%rowtype;
  v_tx_id uuid;
  v_balance bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_school_id := private.current_staff_school_id();
  if v_school_id is null or not private.cashless_is_school_admin(v_school_id) then
    raise exception 'Only an authorized school admin or secretary can top up wallets'
      using errcode = '42501';
  end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 or p_amount_kobo > 100000000000 then
    raise exception 'Invalid top-up amount' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  select * into v_wallet from public.cashless_wallets w
  where w.id = p_wallet_id and w.school_id = v_school_id for update;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;

  select * into v_existing from public.cashless_transactions t
  where t.school_id = v_school_id and t.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.wallet_id <> v_wallet.id or v_existing.type <> 'top_up'
       or v_existing.amount_kobo <> p_amount_kobo then
      raise exception 'Idempotency key was already used for a different transaction'
        using errcode = '23505';
    end if;
    return query select v_existing.id, v_existing.balance_after_kobo, true;
    return;
  end if;

  if v_wallet.balance_kobo > 9000000000000000000 - p_amount_kobo then
    raise exception 'Wallet balance limit exceeded' using errcode = '22003';
  end if;
  v_balance := v_wallet.balance_kobo + p_amount_kobo;
  update public.cashless_wallets set balance_kobo = v_balance where id = v_wallet.id;
  insert into public.cashless_transactions
    (school_id, wallet_id, type, amount_kobo, balance_after_kobo, reference,
     idempotency_key, note, actor_user_id)
  values
    (v_school_id, v_wallet.id, 'top_up', p_amount_kobo, v_balance, p_reference,
     p_idempotency_key, p_note, auth.uid())
  returning id into v_tx_id;

  return query select v_tx_id, v_balance, false;
end;
$$;

create or replace function public.cashless_debit(
  p_qr_token text,
  p_amount_kobo bigint,
  p_idempotency_key text,
  p_note text default null
)
returns table (transaction_id uuid, student_name text, balance_after_kobo bigint, was_duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.cashless_wallets%rowtype;
  v_existing public.cashless_transactions%rowtype;
  v_school_id uuid;
  v_student_name text;
  v_balance bigint;
  v_tx_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_qr_token is null or length(p_qr_token) < 32 or length(p_qr_token) > 256 then
    raise exception 'Invalid QR token' using errcode = '22023';
  end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 or p_amount_kobo > 100000000 then
    raise exception 'Purchase amount must be greater than zero and within the allowed limit'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  select w.* into v_wallet
  from public.cashless_wallets w
  where w.qr_token_hash = encode(extensions.digest(p_qr_token, 'sha256'), 'hex')
  for update;

  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;
  v_school_id := v_wallet.school_id;
  if not private.cashless_can_operate(v_school_id) then
    raise exception 'Cashier is not authorized for this school' using errcode = '42501';
  end if;

  select * into v_existing from public.cashless_transactions t
  where t.school_id = v_school_id and t.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.wallet_id <> v_wallet.id or v_existing.type <> 'purchase'
       or v_existing.amount_kobo <> p_amount_kobo then
      raise exception 'Idempotency key was already used for a different transaction'
        using errcode = '23505';
    end if;
    select concat_ws(' ', s.first_name, s.last_name) into v_student_name
    from public.students s where s.id = v_wallet.student_id and s.school_id = v_school_id;
    return query select v_existing.id, v_student_name, v_existing.balance_after_kobo, true;
    return;
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'This wallet is suspended' using errcode = '55000';
  end if;
  if v_wallet.balance_kobo < p_amount_kobo then
    raise exception 'Insufficient wallet balance' using errcode = 'P0001';
  end if;

  v_balance := v_wallet.balance_kobo - p_amount_kobo;
  update public.cashless_wallets set balance_kobo = v_balance where id = v_wallet.id;
  select concat_ws(' ', s.first_name, s.last_name) into v_student_name
  from public.students s where s.id = v_wallet.student_id and s.school_id = v_school_id;

  insert into public.cashless_transactions
    (school_id, wallet_id, type, amount_kobo, balance_after_kobo, idempotency_key, note, actor_user_id)
  values
    (v_school_id, v_wallet.id, 'purchase', p_amount_kobo, v_balance,
     p_idempotency_key, p_note, auth.uid())
  returning id into v_tx_id;

  return query select v_tx_id, v_student_name, v_balance, false;
end;
$$;

create or replace function public.cashless_set_wallet_status(
  p_wallet_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_school_id := private.current_staff_school_id();
  if v_school_id is null or not private.cashless_is_school_admin(v_school_id) then
    raise exception 'Only an authorized school admin or secretary can change wallet status'
      using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid wallet status' using errcode = '22023';
  end if;
  update public.cashless_wallets
  set status = p_status
  where id = p_wallet_id and school_id = v_school_id;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;
end;
$$;

-- SECURITY DEFINER RPCs are explicitly closed to PUBLIC/anon and exposed only
-- to authenticated users; each function independently checks auth.uid() and role.
revoke all on function public.cashless_set_cashier(uuid, boolean) from public, anon;
revoke all on function public.cashless_create_wallet(uuid) from public, anon;
revoke all on function public.cashless_resolve_qr(text) from public, anon;
revoke all on function public.cashless_top_up(uuid, bigint, text, text, text) from public, anon;
revoke all on function public.cashless_debit(text, bigint, text, text) from public, anon;
revoke all on function public.cashless_set_wallet_status(uuid, text) from public, anon;

grant execute on function public.cashless_set_cashier(uuid, boolean) to authenticated;
grant execute on function public.cashless_create_wallet(uuid) to authenticated;
grant execute on function public.cashless_resolve_qr(text) to authenticated;
grant execute on function public.cashless_top_up(uuid, bigint, text, text, text) to authenticated;
grant execute on function public.cashless_debit(text, bigint, text, text) to authenticated;
grant execute on function public.cashless_set_wallet_status(uuid, text) to authenticated;

commit;
