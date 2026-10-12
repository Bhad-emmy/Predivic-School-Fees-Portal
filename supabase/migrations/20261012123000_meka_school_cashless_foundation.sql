-- MEKA School Cashless: minimal, isolated database foundation.
-- Draft only. Do NOT apply to production before isolated testing and review.
-- Cashless uses existing schools/students plus its own wallet, transaction,
-- product and sales records. It does not connect to school fees or fee payments.

begin;

-- Ensures a wallet/sale cannot pair a student with a different school.
create unique index if not exists students_school_id_id_cashless_uq
  on public.students (school_id, id);

create table if not exists public.cashless_wallets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  qr_token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  constraint cashless_wallets_school_student_fk
    foreign key (school_id, student_id)
    references public.students (school_id, id) on delete restrict,
  constraint cashless_wallets_one_per_student unique (school_id, student_id),
  constraint cashless_wallets_school_id_id_unique unique (school_id, id)
);

create table if not exists public.cashless_products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  price_kobo bigint not null check (price_kobo > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cashless_products_school_id_id_unique unique (school_id, id)
);

create table if not exists public.cashless_sales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  wallet_id uuid not null,
  cashier_user_id uuid not null references auth.users(id) on delete restrict,
  total_kobo bigint not null check (total_kobo > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
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
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  line_total_kobo bigint not null check (line_total_kobo > 0),
  constraint cashless_sale_items_sale_fk
    foreign key (school_id, sale_id)
    references public.cashless_sales (school_id, id) on delete restrict,
  constraint cashless_sale_items_product_fk
    foreign key (school_id, product_id)
    references public.cashless_products (school_id, id) on delete restrict
);

create table if not exists public.cashless_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  wallet_id uuid not null,
  sale_id uuid,
  type text not null check (type in ('top_up', 'purchase', 'refund', 'adjustment')),
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
  constraint cashless_transactions_sale_fk
    foreign key (school_id, sale_id)
    references public.cashless_sales (school_id, id) on delete restrict,
  constraint cashless_transactions_idempotency unique (school_id, idempotency_key)
);

create index if not exists cashless_wallets_school_idx
  on public.cashless_wallets (school_id, status);
create index if not exists cashless_transactions_wallet_created_idx
  on public.cashless_transactions (school_id, wallet_id, created_at desc);
create index if not exists cashless_products_school_active_idx
  on public.cashless_products (school_id, active);
create index if not exists cashless_sales_school_created_idx
  on public.cashless_sales (school_id, created_at desc);

-- Staff can read records for their own school. All financial writes must later
-- go through reviewed, atomic database functions, never direct browser writes.
alter table public.cashless_wallets enable row level security;
alter table public.cashless_products enable row level security;
alter table public.cashless_sales enable row level security;
alter table public.cashless_sale_items enable row level security;
alter table public.cashless_transactions enable row level security;

create policy cashless_wallets_staff_read on public.cashless_wallets
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );
create policy cashless_products_staff_read on public.cashless_products
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );
create policy cashless_sales_staff_read on public.cashless_sales
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );
create policy cashless_sale_items_staff_read on public.cashless_sale_items
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );
create policy cashless_transactions_staff_read on public.cashless_transactions
  for select to authenticated using (
    school_id = (select private.current_staff_school_id())
    and lower(coalesce((select public.current_staff_role()), '')) in ('admin', 'secretary')
  );

revoke all on public.cashless_wallets from anon, authenticated;
revoke all on public.cashless_products from anon, authenticated;
revoke all on public.cashless_sales from anon, authenticated;
revoke all on public.cashless_sale_items from anon, authenticated;
revoke all on public.cashless_transactions from anon, authenticated;

grant select on public.cashless_wallets to authenticated;
grant select on public.cashless_products to authenticated;
grant select on public.cashless_sales to authenticated;
grant select on public.cashless_sale_items to authenticated;
grant select on public.cashless_transactions to authenticated;

commit;
