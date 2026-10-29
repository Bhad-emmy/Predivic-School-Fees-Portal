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


-- A learner can register for free and redeem a paid activation PIN later.
-- PIN issuance requires a trusted service or manually verified administrator.
-- The web client receives no INSERT/UPDATE/SELECT access to raw PIN hashes.
create table public.cbt_activation_pins (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  access_days integer check (access_days between 1 and 1825),
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

-- Access is per learner account, not per device. Null expires_at = lifetime.
create table public.cbt_access_grants (
  auth_user_id uuid primary key references public.cbt_learners(auth_user_id) on delete cascade,
  activation_pin_id uuid not null unique references public.cbt_activation_pins(id),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint cbt_access_grant_expiry check (expires_at is null or expires_at > activated_at)
);
alter table public.cbt_access_grants enable row level security;
create policy "learners can read own CBT activation"
on public.cbt_access_grants for select to authenticated
using (auth_user_id = (select auth.uid()));
revoke all on public.cbt_access_grants from public, anon, authenticated;
grant select on public.cbt_access_grants to authenticated;

-- This issuer is strictly for trusted backend / admin workflows.
-- NEVER send the service_role key or issue_cbt_activation_pin to a browser.
-- A null duration creates lifetime access; other durations expire in days.
create function private.issue_cbt_activation_pin(
  p_access_days integer default null,
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
  if p_access_days is not null and
    (p_access_days < 1 or p_access_days > 1825) then
    raise exception 'Invalid PIN duration';
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
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'Sign in before activating your CBT access' using errcode = '42501';
  end if;
  if p_pin is null or length(btrim(p_pin)) > 48 then
    raise exception 'Invalid or used activation code';
  end if;

  -- Serialize activations for one learner to prevent simultaneous redemption.
  perform 1 from public.cbt_learners l
    where l.auth_user_id = v_user
    for update;
  if not found then
    raise exception 'Complete learner registration first' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.cbt_access_grants g
    where g.auth_user_id = v_user
      and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'This learner account already has active access';
  end if;

  select p.* into v_pin
  from public.cbt_activation_pins p
  where p.code_hash = sha256(convert_to(upper(btrim(p_pin)), 'UTF8'))
    and p.redeemed_at is null
    and p.revoked_at is null
  for update of p;

  if not found then
    raise exception 'Invalid or used activation code';
  end if;

  update public.cbt_activation_pins
    set redeemed_at = now(), redeemed_by = v_user
    where id = v_pin.id;

  insert into public.cbt_access_grants
    (auth_user_id, activation_pin_id, activated_at, expires_at)
  values (
    v_user, v_pin.id, now(),
    case
      when v_pin.access_days is null then null
      else now() + make_interval(days => v_pin.access_days)
    end
  )
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
