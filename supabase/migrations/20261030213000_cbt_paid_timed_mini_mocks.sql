-- MEKA CBT paid starter mini-mock engine: a timed 10-question practice session.
-- This is NOT a full official WAEC/WASSCE or JAMB UTME examination format.
-- Additive only. No change to school finance, staff, attendance or results.
-- All answer keys remain in private.cbt_question_keys.

create table public.cbt_mock_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.cbt_learners(auth_user_id) on delete cascade,
  exam_type text not null check (exam_type in ('WAEC','JAMB')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  completed_at timestamptz,
  score integer,
  total_questions integer not null default 10 check (total_questions = 10),
  constraint cbt_mock_deadline_after_start check (deadline_at > started_at),
  constraint cbt_mock_completed_score check (
    (completed_at is null and score is null) or
    (completed_at is not null and score between 0 and total_questions)
  )
);
create index cbt_mock_sessions_learner_idx
  on public.cbt_mock_sessions (learner_id, started_at desc);
alter table public.cbt_mock_sessions enable row level security;
create policy "Learners read own CBT mini mock headers"
on public.cbt_mock_sessions for select to authenticated
using (learner_id = (select auth.uid()));
revoke all on public.cbt_mock_sessions from public, anon, authenticated;
grant select on public.cbt_mock_sessions to authenticated;

-- No direct Data API access to questions, answers, or answer status.
-- Learners must use the authorized, server-side RPCs below.
create table private.cbt_mock_session_items (
  session_id uuid not null references public.cbt_mock_sessions(id) on delete cascade,
  position integer not null check (position between 1 and 10),
  question_id uuid not null references public.cbt_questions(id),
  chosen_option text check (chosen_option in ('A','B','C','D')),
  answered_at timestamptz,
  primary key (session_id, position),
  unique (session_id, question_id),
  constraint cbt_mock_answer_has_timestamp check (
    (chosen_option is null and answered_at is null)
    or (chosen_option is not null and answered_at is not null)
  )
);
alter table private.cbt_mock_session_items enable row level security;
revoke all on private.cbt_mock_session_items from public, anon, authenticated;

-- All new paid sessions require an active, verified CBT access grant.
-- A learner may finish a session started with active access even if their PIN
-- expires mid-attempt; the timer remains enforceable by server timestamps.
create function public.start_cbt_mini_mock(p_exam_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_exam text := upper(btrim(coalesce(p_exam_type,'')));
  v_session uuid;
  v_existing uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in to your learner account' using errcode='42501';
  end if;
  if v_exam not in ('WAEC','JAMB') then
    raise exception 'Choose WAEC or JAMB';
  end if;

  -- Serialize attempts per learner, preventing concurrent starts.
  perform 1 from public.cbt_learners l
  where l.auth_user_id = v_user for update;
  if not found then
    raise exception 'Create a learner profile first' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.cbt_access_grants g
    where g.auth_user_id=v_user and g.expires_at > now()
  ) then
    raise exception 'An active 30-day CBT PIN is required for timed mocks'
      using errcode='42501';
  end if;

  select s.id into v_existing from public.cbt_mock_sessions s
  where s.learner_id=v_user and s.completed_at is null
  order by s.started_at desc limit 1;
  if v_existing is not null then
    raise exception 'Finish your existing mini mock before starting a new one';
  end if;

  insert into public.cbt_mock_sessions
    (learner_id,exam_type,deadline_at,total_questions)
  values
    (v_user,v_exam,now()+interval '10 minutes',10)
  returning id into v_session;

  with selected as (
    select q.id, random() as shuffle
    from public.cbt_questions q
    where q.exam_type=v_exam
      and q.is_published=true
      and q.is_free_preview=false
    order by shuffle limit 10
  )
  insert into private.cbt_mock_session_items(session_id,position,question_id)
  select v_session,row_number() over (order by s.shuffle)::integer,s.id
  from selected s;

  select count(*) into v_count
  from private.cbt_mock_session_items i
  where i.session_id=v_session;

  if v_count <> 10 then
    raise exception 'Not enough reviewed premium questions to start this mock';
  end if;

  return jsonb_build_object(
    'session_id',v_session,
    'exam_type',v_exam,
    'question_count',10,
    'deadline_at',(select deadline_at from public.cbt_mock_sessions where id=v_session)
  );
end;
$$;
revoke all on function public.start_cbt_mini_mock(text)
from public, anon;
grant execute on function public.start_cbt_mini_mock(text) to authenticated;

create function public.get_cbt_mini_mock(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.cbt_mock_sessions%rowtype;
  v_items jsonb;
begin
  if v_user is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select * into v_session from public.cbt_mock_sessions s
  where s.id=p_session_id and s.learner_id=v_user;
  if not found then
    raise exception 'Mock session not found' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',i.position,
    'question_id',q.id,
    'subject',q.subject,
    'topic',q.topic,
    'question_text',q.question_text,
    'option_a',q.option_a,
    'option_b',q.option_b,
    'option_c',q.option_c,
    'option_d',q.option_d,
    'chosen_option',i.chosen_option
  ) order by i.position),'[]'::jsonb)
  into v_items
  from private.cbt_mock_session_items i
  join public.cbt_questions q on q.id=i.question_id
  where i.session_id=v_session.id;

  return jsonb_build_object(
    'session_id',v_session.id,
    'exam_type',v_session.exam_type,
    'started_at',v_session.started_at,
    'deadline_at',v_session.deadline_at,
    'server_time',now(),
    'completed_at',v_session.completed_at,
    'score',v_session.score,
    'question_count',v_session.total_questions,
    'questions',v_items
  );
end;
$$;
revoke all on function public.get_cbt_mini_mock(uuid)
from public, anon;
grant execute on function public.get_cbt_mini_mock(uuid) to authenticated;

create function public.answer_cbt_mini_mock(
  p_session_id uuid,
  p_question_id uuid,
  p_chosen_option text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.cbt_mock_sessions%rowtype;
  v_option text := upper(btrim(coalesce(p_chosen_option,'')));
begin
  if v_user is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if v_option not in ('A','B','C','D') then
    raise exception 'Choose A, B, C or D';
  end if;

  select * into v_session from public.cbt_mock_sessions s
  where s.id=p_session_id and s.learner_id=v_user
  for update;
  if not found then
    raise exception 'Mock session not found' using errcode='42501';
  end if;
  if v_session.completed_at is not null then
    raise exception 'This mock has already been submitted';
  end if;
  if now() >= v_session.deadline_at then
    raise exception 'Time has expired. Submit to receive your score.';
  end if;

  update private.cbt_mock_session_items i
    set chosen_option=v_option, answered_at=now()
  where i.session_id=v_session.id and i.question_id=p_question_id;
  if not found then
    raise exception 'Question is not part of your mock session';
  end if;

  return jsonb_build_object('saved',true,'question_id',p_question_id,'chosen_option',v_option);
end;
$$;
revoke all on function public.answer_cbt_mini_mock(uuid,uuid,text)
from public, anon;
grant execute on function public.answer_cbt_mini_mock(uuid,uuid,text) to authenticated;

create function public.finish_cbt_mini_mock(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.cbt_mock_sessions%rowtype;
  v_score integer;
  v_answered integer;
begin
  if v_user is null then raise exception 'Sign in first' using errcode='42501'; end if;

  select * into v_session from public.cbt_mock_sessions s
  where s.id=p_session_id and s.learner_id=v_user
  for update;
  if not found then
    raise exception 'Mock session not found' using errcode='42501';
  end if;

  if v_session.completed_at is null then
    select count(*) filter(where i.chosen_option=k.correct_option)::integer,
           count(*) filter(where i.chosen_option is not null)::integer
    into v_score,v_answered
    from private.cbt_mock_session_items i
    join private.cbt_question_keys k on k.question_id=i.question_id
    where i.session_id=v_session.id;

    update public.cbt_mock_sessions
      set completed_at=now(),score=v_score
    where id=v_session.id
    returning * into v_session;
  else
    select count(*) filter(where i.chosen_option is not null)::integer
    into v_answered
    from private.cbt_mock_session_items i
    where i.session_id=v_session.id;
  end if;

  return jsonb_build_object(
    'session_id',v_session.id,
    'exam_type',v_session.exam_type,
    'score',v_session.score,
    'total_questions',v_session.total_questions,
    'answered_count',v_answered,
    'completed_at',v_session.completed_at,
    'deadline_at',v_session.deadline_at
  );
end;
$$;
revoke all on function public.finish_cbt_mini_mock(uuid)
from public, anon;
grant execute on function public.finish_cbt_mini_mock(uuid) to authenticated;

-- Answer keys are revealed only to the same learner after the entire mock
-- is marked complete. Any other user gets a generic access error.
create function public.review_cbt_mini_mock(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_completed timestamptz;
  v_review jsonb;
begin
  if v_user is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select s.completed_at into v_completed
  from public.cbt_mock_sessions s
  where s.id=p_session_id and s.learner_id=v_user;
  if not found or v_completed is null then
    raise exception 'Finish your own mock before viewing corrections'
      using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',i.position,
    'question_id',i.question_id,
    'chosen_option',i.chosen_option,
    'correct_option',k.correct_option,
    'is_correct',coalesce(i.chosen_option=k.correct_option,false),
    'explanation',k.explanation
  ) order by i.position),'[]'::jsonb)
  into v_review
  from private.cbt_mock_session_items i
  join private.cbt_question_keys k on k.question_id=i.question_id
  where i.session_id=p_session_id;

  return jsonb_build_object('session_id',p_session_id,'review',v_review);
end;
$$;
revoke all on function public.review_cbt_mini_mock(uuid)
from public, anon;
grant execute on function public.review_cbt_mini_mock(uuid) to authenticated;
