-- Enforce enough premium content for three fresh 10-question mini mocks.
-- The existing unseen-first/least-seen selector remains unchanged.
create or replace function public.start_cbt_mini_mock(p_exam_type text)
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
  v_pool_count integer;
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

  -- A three-rotation guarantee for the current 10-question mini mock
  -- requires at least 30 published premium items in the exam category.
  -- This is separate from the much larger subject-specific full mock targets.
  select count(*) into v_pool_count
  from public.cbt_questions q
  where q.exam_type = v_exam
    and q.is_published = true
    and q.is_free_preview = false;
  if v_pool_count < 30 then
    raise exception 'This exam needs at least 30 reviewed premium questions before three-rotation mini mocks can start';
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

  -- Prioritize questions this learner has never received in any mock.
  -- If the pool is exhausted, select the least-seen questions, preferring
  -- those not shown recently. Independent learners have separate histories.
  -- Apply a fresh random tie-breaker for every session, then shuffle display
  -- positions independently so topic/answer order is not predictable.
  with learner_history as (
    select i.question_id,
           count(*)::integer as exposure_count,
           max(s.started_at) as last_seen_at
    from public.cbt_mock_sessions s
    join private.cbt_mock_session_items i on i.session_id = s.id
    where s.learner_id = v_user and s.exam_type = v_exam
      and s.id <> v_session
    group by i.question_id
  ),
  selected as (
    select q.id,
           coalesce(h.exposure_count, 0) as exposure_count,
           h.last_seen_at,
           random() as shuffle
    from public.cbt_questions q
    left join learner_history h on h.question_id = q.id
    where q.exam_type=v_exam
      and q.is_published=true
      and q.is_free_preview=false
    order by coalesce(h.exposure_count, 0), h.last_seen_at asc nulls first, shuffle
    limit 10
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

revoke all on function public.start_cbt_mini_mock(text) from public, anon;
grant execute on function public.start_cbt_mini_mock(text) to authenticated;
