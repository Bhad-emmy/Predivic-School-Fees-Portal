-- CBT dual-audience learner identity foundation.
-- Additive only: existing students, fee accounts, parent accounts and staff remain untouched.
-- Apply before deploying the /learn portal and school invitation UI.

create table public.cbt_learners (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  learner_type text not null check (learner_type in ('external', 'school')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  school_id uuid references public.schools(id),
  student_id uuid unique references public.students(id),
  created_at timestamptz not null default now(),
  constraint cbt_learner_audience_consistency check (
    (learner_type = 'external' and school_id is null and student_id is null)
    or (learner_type = 'school' and school_id is not null and student_id is not null)
  )
);

create index cbt_learners_school_idx on public.cbt_learners (school_id)
  where school_id is not null;

alter table public.cbt_learners enable row level security;

-- Self-service registration may create only an independent learner profile.
-- No browser client can attach a user to a school or student record directly.
create policy "cbt learners read own profile"
on public.cbt_learners for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy "school admins read linked cbt learners"
on public.cbt_learners for select to authenticated
using (
  learner_type = 'school'
  and exists (
    select 1 from public.teachers t
    join public.schools s on s.id = t.school_id
    where t.auth_user_id = (select auth.uid())
      and lower(t.role) = 'admin'
      and lower(t.status) = 'active'
      and lower(s.status) = 'active'
      and t.school_id = cbt_learners.school_id
  )
);

create policy "learners may create only independent profiles"
on public.cbt_learners for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and learner_type = 'external'
  and school_id is null and student_id is null
);

revoke all on table public.cbt_learners from anon;
grant select, insert on table public.cbt_learners to authenticated;

-- Invite codes are stored as SHA-256 digests, never as raw reusable strings.
create table public.cbt_school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index cbt_school_invites_student_idx
  on public.cbt_school_invites (school_id, student_id, expires_at);
alter table public.cbt_school_invites enable row level security;
revoke all on table public.cbt_school_invites from public, anon, authenticated;

-- Admin-only invitation issuance; enforce same-school membership server-side.
create function public.issue_cbt_school_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select st.school_id into v_school_id
  from public.students st
  where st.id = p_student_id and lower(st.status) = 'active';

  if v_school_id is null or not exists (
    select 1 from public.teachers t
    join public.schools s on s.id = t.school_id
    where t.auth_user_id = (select auth.uid())
      and t.school_id = v_school_id
      and lower(t.role) = 'admin'
      and lower(t.status) = 'active'
      and lower(s.status) = 'active'
  ) then
    raise exception 'Not authorized to issue this student invitation' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.cbt_learners l
    where l.student_id = p_student_id
  ) then
    raise exception 'This student already has a CBT login';
  end if;

  -- Revoke earlier, unused codes for this student.
  update public.cbt_school_invites
     set expires_at = now()
   where school_id = v_school_id
     and student_id = p_student_id
     and redeemed_at is null;

  -- Two independent UUIDs give sufficient entropy for single-use invitations.
  v_code := gen_random_uuid()::text || '-' || gen_random_uuid()::text;

  insert into public.cbt_school_invites
    (school_id, student_id, token_hash, created_by, expires_at)
  values
    (v_school_id, p_student_id, sha256(convert_to(v_code, 'UTF8')),
     (select auth.uid()), now() + interval '48 hours');

  return v_code;
end;
$$;
revoke all on function public.issue_cbt_school_invite(uuid) from public, anon;
grant execute on function public.issue_cbt_school_invite(uuid) to authenticated;

-- School membership can only be established with a live, unredeemed invitation.
-- An independent learner can upgrade to their verified school-linked identity.
create function public.redeem_cbt_school_invite(p_code text)
returns public.cbt_learners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.cbt_school_invites%rowtype;
  v_learner public.cbt_learners%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_code is null or char_length(p_code) > 90 then
    raise exception 'Invitation invalid or expired';
  end if;
  -- A public learner may later join their registered school with the
  -- same Auth account. Their future mock attempt history stays attached
  -- to auth_user_id, and school membership remains invite-only.
  if exists (
    select 1 from public.cbt_learners l
    where l.auth_user_id = (select auth.uid())
      and l.learner_type = 'school'
  ) then
    raise exception 'This learner is already linked to a school';
  end if;

  select i.* into v_invite
  from public.cbt_school_invites i
  join public.students st on st.id = i.student_id and st.school_id = i.school_id
  join public.schools s on s.id = i.school_id
  where i.token_hash = sha256(convert_to(btrim(p_code), 'UTF8'))
    and i.redeemed_at is null
    and i.expires_at > now()
    and lower(st.status) = 'active'
    and lower(s.status) = 'active'
  for update of i;

  if not found then
    raise exception 'Invitation invalid or expired';
  end if;

  insert into public.cbt_learners
    (auth_user_id, learner_type, school_id, student_id, display_name)
  select (select auth.uid()), 'school', st.school_id, st.id,
         concat_ws(' ', st.first_name, nullif(st.middle_name, ''), st.last_name)
    from public.students st
   where st.id = v_invite.student_id
  on conflict (auth_user_id) do update
    set learner_type = 'school',
        school_id = excluded.school_id,
        student_id = excluded.student_id,
        display_name = excluded.display_name
    where cbt_learners.learner_type = 'external'
      and cbt_learners.school_id is null
      and cbt_learners.student_id is null
  returning * into v_learner;

  if v_learner.auth_user_id is null then
    raise exception 'This learner cannot be linked to another school';
  end if;

  update public.cbt_school_invites
     set redeemed_at = now(), redeemed_by = (select auth.uid())
   where id = v_invite.id;

  return v_learner;
end;
$$;
revoke all on function public.redeem_cbt_school_invite(text) from public, anon;
grant execute on function public.redeem_cbt_school_invite(text) to authenticated;


-- Proposed MEKA CBT subscription offer; not available for purchase yet.
-- Currency is stored in NGN minor units (kobo). 150000 kobo = NGN 1500.
create table public.cbt_subscription_plans (
  code text primary key,
  title text not null,
  currency text not null check (currency = 'NGN'),
  price_kobo integer not null check (price_kobo > 0),
  duration_days integer not null check (duration_days > 0),
  sales_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.cbt_subscription_plans
  (code, title, currency, price_kobo, duration_days, sales_enabled)
values
  ('monthly_30', 'MEKA CBT 30-Day Access', 'NGN', 150000, 30, false);
alter table public.cbt_subscription_plans enable row level security;
revoke all on table public.cbt_subscription_plans from public, anon, authenticated;
grant select on table public.cbt_subscription_plans to service_role;

-- A learner can register for free and redeem a paid activation PIN later.
-- PIN issuance requires a trusted service or manually verified administrator.
-- The web client receives no INSERT/UPDATE/SELECT access to raw PIN hashes.
create table public.cbt_activation_pins (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  plan_code text not null default 'monthly_30'
    references public.cbt_subscription_plans(code),
  access_days integer not null default 30 check (access_days = 30),
  issued_via text not null default 'manual'
    check (issued_via in ('manual','verified_payment','agent','school')),
  order_reference text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id),
  revoked_at timestamptz
);
create index cbt_activation_pins_order_reference_idx
  on public.cbt_activation_pins (order_reference)
  where order_reference is not null;
alter table public.cbt_activation_pins enable row level security;
revoke all on table public.cbt_activation_pins from public, anon, authenticated;

-- Access is for 30 days per PIN, per learner account, not per device.
create table public.cbt_access_grants (
  auth_user_id uuid primary key references public.cbt_learners(auth_user_id) on delete cascade,
  activation_pin_id uuid not null unique references public.cbt_activation_pins(id),
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint cbt_access_grant_expiry check (expires_at > activated_at)
);
alter table public.cbt_access_grants enable row level security;
create policy "learners can read own CBT activation"
on public.cbt_access_grants for select to authenticated
using (auth_user_id = (select auth.uid()));
revoke all on public.cbt_access_grants from public, anon, authenticated;
grant select on public.cbt_access_grants to authenticated;

-- This issuer is strictly for trusted backend / admin workflows.
-- NEVER send the service_role key or issue_cbt_activation_pin to a browser.
-- This launch offers only 30-day PINs. Lifetime PINs are not supported.
create function private.issue_cbt_activation_pin(
  p_access_days integer default 30,
  p_issued_via text default 'manual',
  p_order_reference text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin text;
begin
  if p_access_days is distinct from 30 then
    raise exception 'Only 30-day MEKA CBT activation PINs are supported';
  end if;
  if p_issued_via not in ('manual','verified_payment','agent','school') then
    raise exception 'Invalid PIN source';
  end if;

  -- Cryptographically strong 128-bit token, displayed only to issuer.
  v_pin := 'MEKA-' || upper(replace(gen_random_uuid()::text, '-', ''));

  insert into public.cbt_activation_pins
    (code_hash, access_days, issued_via, order_reference)
  values
    (sha256(convert_to(v_pin, 'UTF8')), p_access_days,
     p_issued_via, nullif(btrim(p_order_reference), ''));

  return v_pin;
end;
$$;
revoke all on function private.issue_cbt_activation_pin(integer,text,text)
  from public, anon, authenticated;
grant execute on function private.issue_cbt_activation_pin(integer,text,text)
  to service_role;

-- Atomically redeem exactly one available PIN to a verified learner account.
-- Strong random PINs mitigate guessing; add API rate limits before mass launch.
create function public.redeem_cbt_activation_pin(p_pin text)
returns public.cbt_access_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_pin public.cbt_activation_pins%rowtype;
  v_grant public.cbt_access_grants%rowtype;
  v_existing_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'Sign in before activating your CBT access' using errcode = '42501';
  end if;
  if p_pin is null or length(btrim(p_pin)) > 48 then
    raise exception 'Invalid or used activation code';
  end if;

  -- Serialize first activations and early renewals for one account.
  perform 1 from public.cbt_learners l
    where l.auth_user_id = v_user
    for update;
  if not found then
    raise exception 'Complete learner registration first' using errcode = '42501';
  end if;

  -- Renewals are allowed before expiry. Preserve any unused paid days by
  -- extending the existing expiry instead of restarting it from today.
  select g.expires_at into v_existing_expiry
    from public.cbt_access_grants g
   where g.auth_user_id = v_user
    for update;

  select p.* into v_pin
  from public.cbt_activation_pins p
  where p.code_hash = sha256(convert_to(upper(btrim(p_pin)), 'UTF8'))
    and p.redeemed_at is null
    and p.revoked_at is null
  for update of p;

  if not found then
    raise exception 'Invalid or used activation code';
  end if;

  -- For a renewal purchased before expiry, add exactly 30 days to the
  -- existing expiration. For an expired or first-time account, start now.
  v_new_expiry := greatest(now(), coalesce(v_existing_expiry, now()))
    + make_interval(days => v_pin.access_days);

  update public.cbt_activation_pins
    set redeemed_at = now(), redeemed_by = v_user
    where id = v_pin.id;

  insert into public.cbt_access_grants
    (auth_user_id, activation_pin_id, activated_at, expires_at)
  values (v_user, v_pin.id, now(), v_new_expiry)
  on conflict (auth_user_id) do update
    set activation_pin_id = excluded.activation_pin_id,
        activated_at = excluded.activated_at,
        expires_at = excluded.expires_at
  returning * into v_grant;

  return v_grant;
end;
$$;
revoke all on function public.redeem_cbt_activation_pin(text)
  from public, anon;
grant execute on function public.redeem_cbt_activation_pin(text)
  to authenticated;


-- OPay V1: manual transfer confirmation and private operator-only PIN issuance.
-- Never treat a screenshot, client-side checkbox or message as evidence of payment.
-- The operator must independently verify the received transfer in OPay.
-- Sales stay disabled in cbt_subscription_plans until the operator has been
-- provisioned, receiving details verified and staging tests passed.

create table private.cbt_platform_operators (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.cbt_platform_operators enable row level security;
revoke all on table private.cbt_platform_operators from public, anon, authenticated;

alter table public.cbt_activation_pins
  add column confirmed_by uuid references auth.users(id),
  add column confirmed_at timestamptz,
  add column confirmed_amount_kobo integer
    check (confirmed_amount_kobo is null or confirmed_amount_kobo > 0);

-- One independently confirmed OPay transaction can fund one PIN only.
-- Normalizing case and whitespace prevents minor formatting duplicates.
create unique index cbt_manual_opay_transfer_reference_unique
on public.cbt_activation_pins ((lower(btrim(order_reference))))
where issued_via = 'manual' and order_reference is not null;

create function public.is_cbt_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from private.cbt_platform_operators o
    join public.teachers t on t.auth_user_id = o.auth_user_id
    join public.schools s on s.id = t.school_id
    where o.auth_user_id = (select auth.uid())
      and o.is_active = true
      and lower(t.role) = 'admin'
      and lower(t.status) = 'active'
      and lower(s.status) = 'active'
  );
$$;
revoke all on function public.is_cbt_platform_operator()
  from public, anon;
grant execute on function public.is_cbt_platform_operator()
  to authenticated;

create function public.cbt_opay_sales_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((
      select p.sales_enabled
      from public.cbt_subscription_plans p
      where p.code = 'monthly_30'
    ), false);
$$;
revoke all on function public.cbt_opay_sales_enabled()
  from public, anon;
grant execute on function public.cbt_opay_sales_enabled()
  to authenticated;

-- Trusted operator workflow. The checkbox in the UI is an attestation only;
-- the actual transfer must be checked in OPay before calling this function.
create function public.issue_verified_opay_cbt_pin(p_transaction_reference text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_pin text;
  v_price_kobo integer;
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Not authorized to issue CBT activation PINs'
      using errcode = '42501';
  end if;

  v_reference := btrim(coalesce(p_transaction_reference, ''));
  if char_length(v_reference) < 6 or char_length(v_reference) > 120 then
    raise exception 'Enter the verified OPay transaction reference';
  end if;
  if v_reference ~ '[[:cntrl:]]' then
    raise exception 'Invalid transaction reference';
  end if;

  select p.price_kobo into v_price_kobo
  from public.cbt_subscription_plans p
  where p.code = 'monthly_30' and p.sales_enabled;

  if v_price_kobo is null then
    raise exception 'Manual OPay PIN issuance is not enabled yet';
  end if;

  -- The database controls the price and duration. This function cannot
  -- be called by an ordinary learner, school admin, or unknown staff.
  v_pin := private.issue_cbt_activation_pin(
    30, 'manual', v_reference
  );

  update public.cbt_activation_pins
    set confirmed_by = (select auth.uid()),
        confirmed_at = now(),
        confirmed_amount_kobo = v_price_kobo
    where code_hash = sha256(convert_to(v_pin, 'UTF8'));

  return v_pin;
exception
  when unique_violation then
    raise exception 'An activation PIN was already issued for this OPay transaction reference';
end;
$$;
revoke all on function public.issue_verified_opay_cbt_pin(text)
  from public, anon;
grant execute on function public.issue_verified_opay_cbt_pin(text)
  to authenticated;

-- No payment account number is stored here. Configure receiving details only
-- after the operator has supplied and verified the correct OPay recipient.
-- Provision operators by trusted admin SQL after validating auth_user_id.
-- NEVER allow a public signup to add rows to private.cbt_platform_operators.


-- WAEC/JAMB objective question bank (operator-reviewed; original or licensed).
-- Correct options and explanations reside in a non-exposed private schema.
-- All content is DRAFT by default. No copyrighted questions are bundled here.
create table public.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null check (exam_type in ('WAEC','JAMB')),
  subject text not null check (char_length(btrim(subject)) between 2 and 80),
  topic text not null check (char_length(btrim(topic)) between 2 and 120),
  question_text text not null check (char_length(btrim(question_text)) between 10 and 6000),
  option_a text not null check (char_length(btrim(option_a)) between 1 and 2000),
  option_b text not null check (char_length(btrim(option_b)) between 1 and 2000),
  option_c text not null check (char_length(btrim(option_c)) between 1 and 2000),
  option_d text not null check (char_length(btrim(option_d)) between 1 and 2000),
  content_origin text not null check (content_origin in ('original','licensed')),
  license_reference text,
  is_free_preview boolean not null default false,
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint cbt_question_license_metadata check (
    content_origin = 'original'
    or nullif(btrim(license_reference), '') is not null
  )
);
create index cbt_questions_published_search_idx
  on public.cbt_questions (exam_type, subject, topic)
  where is_published = true;
alter table public.cbt_questions enable row level security;
revoke all on public.cbt_questions from public, anon, authenticated;
grant select on public.cbt_questions to authenticated;

create table private.cbt_question_keys (
  question_id uuid primary key references public.cbt_questions(id) on delete cascade,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text not null check (char_length(btrim(explanation)) between 5 and 6000)
);
alter table private.cbt_question_keys enable row level security;
revoke all on private.cbt_question_keys from public, anon, authenticated;

-- RLS: a learner can see approved free samples, or approved premium content
-- with an unexpired server-side grant. Operators can preview unpublished items.
create policy "CBT operator can review question drafts"
on public.cbt_questions for select to authenticated
using (public.is_cbt_platform_operator());

create policy "CBT learners can read entitled practice questions"
on public.cbt_questions for select to authenticated
using (
  is_published = true
  and exists (
    select 1 from public.cbt_learners l
    where l.auth_user_id = (select auth.uid())
  )
  and (
    is_free_preview = true
    or exists (
      select 1 from public.cbt_access_grants g
      where g.auth_user_id = (select auth.uid())
        and g.expires_at > now()
    )
  )
);

-- Only a vetted MEKA CBT operator can author or publish bank content.
-- The client never inserts questions or answer keys directly.
create function public.create_cbt_practice_question(
  p_exam_type text,
  p_subject text,
  p_topic text,
  p_question_text text,
  p_option_a text,
  p_option_b text,
  p_option_c text,
  p_option_d text,
  p_correct_option text,
  p_explanation text,
  p_content_origin text,
  p_license_reference text default null,
  p_is_free_preview boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Only authorized MEKA CBT operators may add questions'
      using errcode = '42501';
  end if;
  if upper(btrim(coalesce(p_correct_option,''))) not in ('A','B','C','D') then
    raise exception 'Answer must be A, B, C or D';
  end if;

  insert into public.cbt_questions (
    exam_type, subject, topic, question_text,
    option_a, option_b, option_c, option_d,
    content_origin, license_reference, is_free_preview, created_by
  )
  values (
    upper(btrim(p_exam_type)), btrim(p_subject), btrim(p_topic),
    btrim(p_question_text), btrim(p_option_a), btrim(p_option_b),
    btrim(p_option_c), btrim(p_option_d),
    lower(btrim(p_content_origin)), nullif(btrim(p_license_reference), ''),
    coalesce(p_is_free_preview, false), (select auth.uid())
  )
  returning id into v_id;

  insert into private.cbt_question_keys (question_id, correct_option, explanation)
  values (
    v_id, upper(btrim(p_correct_option)), btrim(p_explanation)
  );
  return v_id;
end;
$$;
revoke all on function public.create_cbt_practice_question(
  text,text,text,text,text,text,text,text,text,text,text,text,boolean
) from public, anon;
grant execute on function public.create_cbt_practice_question(
  text,text,text,text,text,text,text,text,text,text,text,text,boolean
) to authenticated;

create function public.set_cbt_question_published(
  p_question_id uuid,
  p_published boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Only authorized MEKA CBT operators may publish questions'
      using errcode = '42501';
  end if;
  update public.cbt_questions q
    set is_published = p_published,
        published_at = case when p_published then now() else null end
    where q.id = p_question_id
      and exists (
        select 1 from private.cbt_question_keys k
        where k.question_id = q.id
      );
  if not found then
    raise exception 'Question or answer key not found';
  end if;
  return true;
end;
$$;
revoke all on function public.set_cbt_question_published(uuid,boolean)
  from public, anon;
grant execute on function public.set_cbt_question_published(uuid,boolean)
  to authenticated;

-- Practice submissions are scored server-side; students never query keys.
-- WAEC and JAMB scores here are unofficial practice only.
create table public.cbt_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.cbt_learners(auth_user_id) on delete cascade,
  question_id uuid not null references public.cbt_questions(id),
  chosen_option text not null check (chosen_option in ('A','B','C','D')),
  is_correct boolean not null,
  submitted_at timestamptz not null default now()
);
create index cbt_practice_attempts_learner_idx
  on public.cbt_practice_attempts (learner_id, submitted_at desc);
alter table public.cbt_practice_attempts enable row level security;
create policy "learners read own CBT practice history"
on public.cbt_practice_attempts for select to authenticated
using (learner_id = (select auth.uid()));
revoke all on public.cbt_practice_attempts from public, anon, authenticated;
grant select on public.cbt_practice_attempts to authenticated;

-- Atomically record practice and reveal the correction for that question.
-- This is topic practice, not yet a timed, anti-cheating exam engine.
create function public.submit_cbt_practice_answer(
  p_question_id uuid,
  p_chosen_option text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_correct_option text;
  v_explanation text;
  v_chosen text := upper(btrim(coalesce(p_chosen_option, '')));
  v_attempt_id uuid;
begin
  if v_user is null or not exists (
    select 1 from public.cbt_learners l where l.auth_user_id = v_user
  ) then
    raise exception 'Sign in to a learner account first' using errcode = '42501';
  end if;
  if v_chosen not in ('A','B','C','D') then
    raise exception 'Choose answer A, B, C or D';
  end if;
  if not exists (
    select 1 from public.cbt_questions q
    where q.id = p_question_id
      and q.is_published = true
      and (
        q.is_free_preview
        or exists (
          select 1 from public.cbt_access_grants g
          where g.auth_user_id = v_user
            and g.expires_at > now()
        )
      )
  ) then
    raise exception 'Question unavailable or subscription inactive'
      using errcode = '42501';
  end if;

  select k.correct_option, k.explanation
  into v_correct_option, v_explanation
  from private.cbt_question_keys k
  where k.question_id = p_question_id;

  if v_correct_option is null then
    raise exception 'Question answer key is unavailable';
  end if;

  insert into public.cbt_practice_attempts
    (learner_id, question_id, chosen_option, is_correct)
  values
    (v_user, p_question_id, v_chosen, v_chosen = v_correct_option)
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'is_correct', v_chosen = v_correct_option,
    'correct_option', v_correct_option,
    'explanation', v_explanation
  );
end;
$$;
revoke all on function public.submit_cbt_practice_answer(uuid,text)
  from public, anon;
grant execute on function public.submit_cbt_practice_answer(uuid,text)
  to authenticated;
