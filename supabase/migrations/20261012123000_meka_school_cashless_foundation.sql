-- MEKA School Cashless: minimal wallet and ledger foundation.
-- Draft only. Do NOT apply to production before isolated testing and review.
-- Physical canteen workflow: scan student QR, enter amount, debit wallet.
-- No online store, product catalogue, inventory, or school-fees integration.

begin;

-- Supports a composite FK that prevents cross-school student/wallet pairing.
create unique index if not exists students_school_id_id_cashless_uq
  on public.students (school_id, id);

create table if not exists public.cashless_wallets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  qr_token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  constraint cashless_wallets_school_student_fk
    foreign key (school_id, student_id)
    references public.students (school_id, id) on delete restrict,
  constraint cashless_wallets_one_per_student unique (school_id, student_id),
  constraint cashless_wallets_school_id_id_unique unique (school_id, id)
);

-- Every top-up or debit is recorded in one append-only-style ledger.
-- Amounts are positive kobo; transaction type determines their meaning.
create table if not exists public.cashless_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  wallet_id uuid not null,
  type text not null
    check (type in ('top_up', 'purchase', 'refund', 'adjustment')),
  amount_kobo bigint not null check (amount_kobo > 0),
  balance_after_kobo bigint not null check (balance_after_kobo >= 0),
  reference text,
  idempotency_key text not null,
  note text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cashless_transactions_wallet_fk
    foreign key (school_id, wallet_id)
    references public.cashless_wallets (school_id, id) on delete restrict,
  constraint cashless_transactions_idempotency
    unique (school_id, idempotency_key)
);

create index if not exists cashless_wallets_school_status_idx
  on public.cashless_wallets (school_id, status);
create index if not exists cashless_transactions_school_wallet_created_idx
  on public.cashless_transactions (school_id, wallet_id, created_at desc);
create index if not exists cashless_transactions_school_created_idx
  on public.cashless_transactions (school_id, created_at desc);

alter table public.cashless_wallets enable row level security;
alter table public.cashless_transactions enable row level security;

create policy cashless_wallets_staff_read on public.cashless_wallets
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );
create policy cashless_transactions_staff_read on public.cashless_transactions
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

-- No direct browser writes. Financial writes must use reviewed, atomic,
-- school-scoped database functions that validate staff and wallet status.
revoke all on public.cashless_wallets from anon, authenticated;
revoke all on public.cashless_transactions from anon, authenticated;
grant select on public.cashless_wallets to authenticated;
grant select on public.cashless_transactions to authenticated;

commit;
