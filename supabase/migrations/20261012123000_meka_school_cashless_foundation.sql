-- MEKA School Cashless: isolated database foundation.
-- This migration is intentionally staged in Git only. Do NOT apply to production
-- until reviewed and tested against an isolated Supabase development database.
-- Cashless references only schools/students and its own Cashless tables. It does
-- not reference school-fee accounts, fee payments, receipts, Paystack, or bank-transfer modules.

begin;

-- Required as a composite FK target, ensuring a Cashless student belongs to
-- the same school as the wallet/card/sale.
create unique index if not exists students_school_id_id_cashless_uq
  on public.students (school_id, id);

create table if not exists public.cashless_wallets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashless_wallets_school_student_fk
    foreign key (school_id, student_id)
    references public.students (school_id, id) on delete restrict,
  constraint cashless_wallets_one_per_student unique (school_id, student_id),
  constraint cashless_wallets_school_id_id_unique unique (school_id, id)
);

create table if not exists public.cashless_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  wallet_id uuid not null,
  kind text not null check (kind in ('top_up', 'purchase', 'refund', 'adjustment')),
  amount_kobo bigint not null check (amount_kobo > 0),
  balance_after_kobo bigint not null check (balance_after_kobo >= 0),
  source text not null check (source in ('bank_transfer_verified', 'cash_received', 'canteen_sale', 'sale_refund', 'admin_adjustment')),
  reference text,
  idempotency_key text not null,
  description text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cashless_wallet_transactions_wallet_fk
    foreign key (school_id, wallet_id)
    references public.cashless_wallets (school_id, id) on delete restrict,
  constraint cashless_wallet_transactions_idempotency unique (school_id, idempotency_key)
);

create table if not exists public.cashless_wristbands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint cashless_wristbands_school_student_fk
    foreign key (school_id, student_id)
    references public.students (school_id, id) on delete restrict
);

create unique index if not exists cashless_one_active_wristband_per_student
  on public.cashless_wristbands (school_id, student_id)
  where status = 'active';

create table if not exists public.cashless_products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  sku text not null,
  name text not null,
  description text,
  price_kobo bigint not null check (price_kobo > 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashless_products_school_sku_unique unique (school_id, sku),
  constraint cashless_products_school_id_id_unique unique (school_id, id)
);

create table if not exists public.cashless_sales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  wallet_id uuid not null,
  cashier_user_id uuid not null references auth.users(id) on delete restrict,
  total_kobo bigint not null check (total_kobo > 0),
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversal_reason text,
  constraint cashless_sales_school_student_fk
    foreign key (school_id, student_id)
    references public.students (school_id, id) on delete restrict,
  constraint cashless_sales_wallet_fk
    foreign key (school_id, wallet_id)
    references public.cashless_wallets (school_id, id) on delete restrict,
  constraint cashless_sales_school_id_id_unique unique (school_id, id),
  constraint cashless_sales_idempotency unique (school_id, idempotency_key)
);

create table if not exists public.cashless_sale_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  sale_id uuid not null,
  product_id uuid not null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  line_total_kobo bigint not null check (line_total_kobo > 0),
  created_at timestamptz not null default now(),
  constraint cashless_sale_items_sale_fk
    foreign key (school_id, sale_id)
    references public.cashless_sales (school_id, id) on delete restrict,
  constraint cashless_sale_items_product_fk
    foreign key (school_id, product_id)
    references public.cashless_products (school_id, id) on delete restrict
);

create table if not exists public.cashless_audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cashless_wallets_school_status_idx
  on public.cashless_wallets (school_id, status);
create index if not exists cashless_wallet_transactions_wallet_created_idx
  on public.cashless_wallet_transactions (school_id, wallet_id, created_at desc);
create index if not exists cashless_wristbands_student_status_idx
  on public.cashless_wristbands (school_id, student_id, status);
create index if not exists cashless_products_school_status_idx
  on public.cashless_products (school_id, status);
create index if not exists cashless_sales_school_created_idx
  on public.cashless_sales (school_id, created_at desc);
create index if not exists cashless_audit_events_school_created_idx
  on public.cashless_audit_events (school_id, created_at desc);

-- All exposed Cashless tables use RLS. Browser clients get read-only access
-- for same-school admin/secretary views. Financial writes will be through
-- reviewed, authenticated database functions added in a later migration.
alter table public.cashless_wallets enable row level security;
alter table public.cashless_wallet_transactions enable row level security;
alter table public.cashless_wristbands enable row level security;
alter table public.cashless_products enable row level security;
alter table public.cashless_sales enable row level security;
alter table public.cashless_sale_items enable row level security;
alter table public.cashless_audit_events enable row level security;

create policy cashless_wallets_staff_read on public.cashless_wallets
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_wallet_transactions_staff_read on public.cashless_wallet_transactions
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_wristbands_staff_read on public.cashless_wristbands
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_products_staff_read on public.cashless_products
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_sales_staff_read on public.cashless_sales
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_sale_items_staff_read on public.cashless_sale_items
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

create policy cashless_audit_events_staff_read on public.cashless_audit_events
  for select to authenticated
  using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

revoke all on public.cashless_wallets from anon, authenticated;
revoke all on public.cashless_wallet_transactions from anon, authenticated;
revoke all on public.cashless_wristbands from anon, authenticated;
revoke all on public.cashless_products from anon, authenticated;
revoke all on public.cashless_sales from anon, authenticated;
revoke all on public.cashless_sale_items from anon, authenticated;
revoke all on public.cashless_audit_events from anon, authenticated;

grant select on public.cashless_wallets to authenticated;
grant select on public.cashless_wallet_transactions to authenticated;
grant select on public.cashless_wristbands to authenticated;
grant select on public.cashless_products to authenticated;
grant select on public.cashless_sales to authenticated;
grant select on public.cashless_sale_items to authenticated;
grant select on public.cashless_audit_events to authenticated;

commit;
