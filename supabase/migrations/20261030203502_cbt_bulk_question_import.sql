-- Content pipeline for large, independently reviewed MEKA CBT question banks.
-- Do not treat copied WAEC/JAMB past papers as original content.
-- Imported questions are DRAFT only; a separate review/publish action is needed.
-- Additive: no school fee, attendance, staff or payment changes.

-- Catch exact same question text within one exam/subject, including a case
-- difference, before an operator accidentally duplicates content via batch.
create unique index if not exists cbt_questions_exam_subject_stem_unique_idx
  on public.cbt_questions (
    exam_type, lower(btrim(subject)), md5(lower(btrim(question_text)))
  );

create function public.import_cbt_question_batch(p_questions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_count integer;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_origin text;
  v_permission text;
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Only approved MEKA CBT content operators may import questions'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Send a JSON array of questions';
  end if;
  v_count := jsonb_array_length(p_questions);
  if v_count < 1 or v_count > 50 then
    raise exception 'Import between 1 and 50 questions per batch';
  end if;

  -- Errors abort the entire batch; do not silently import partial content.
  for v_item in select value from jsonb_array_elements(p_questions)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each imported item must be a question object';
    end if;
    v_origin := lower(btrim(coalesce(v_item->>'content_origin','')));
    v_permission := nullif(btrim(v_item->>'license_reference'),'');

    if v_origin not in ('original','licensed') then
      raise exception 'Every question must be marked original or licensed';
    end if;
    if v_origin = 'licensed' and (v_permission is null or char_length(v_permission) < 8) then
      raise exception 'Licensed content requires an auditable permission reference';
    end if;
    if v_item->>'is_published' = 'true' then
      raise exception 'Bulk imports must be reviewed and published individually';
    end if;
    if coalesce(char_length(v_item->>'question_text'),0) > 6000 or
       coalesce(char_length(v_item->>'explanation'),0) > 6000 or
       coalesce(char_length(v_permission),0) > 2000 then
      raise exception 'Question, explanation, or permission reference is too long';
    end if;

    v_id := public.create_cbt_practice_question(
      v_item->>'exam_type',
      v_item->>'subject',
      v_item->>'topic',
      v_item->>'question_text',
      v_item->>'option_a',
      v_item->>'option_b',
      v_item->>'option_c',
      v_item->>'option_d',
      v_item->>'correct_option',
      v_item->>'explanation',
      v_origin,
      v_permission,
      coalesce((v_item->>'is_free_preview')::boolean, false)
    );
    v_ids := v_ids || jsonb_build_array(v_id);
  end loop;

  return jsonb_build_object(
    'imported_count',v_count,
    'publication_status','draft',
    'question_ids',v_ids
  );
end;
$$;
revoke all on function public.import_cbt_question_batch(jsonb) from public, anon;
grant execute on function public.import_cbt_question_batch(jsonb) to authenticated;

-- Operator-only aggregated view of syllabus bank growth.
-- No answer keys or per-learner activity is returned.
create function public.cbt_question_bank_coverage()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_data jsonb;
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Only approved MEKA CBT operators may view bank coverage'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'exam_type',s.exam_type,
    'subject',s.subject,
    'published_premium',s.published_premium,
    'published_free',s.published_free,
    'drafts',s.drafts,
    'total',s.total
  ) order by s.exam_type,s.subject),'[]'::jsonb)
  into v_data
  from (
    select exam_type,subject,
      count(*) filter (where is_published and not is_free_preview)::int as published_premium,
      count(*) filter (where is_published and is_free_preview)::int as published_free,
      count(*) filter (where not is_published)::int as drafts,
      count(*)::int as total
    from public.cbt_questions
    group by exam_type,subject
  ) s;
  return v_data;
end;
$$;
revoke all on function public.cbt_question_bank_coverage() from public, anon;
grant execute on function public.cbt_question_bank_coverage() to authenticated;
