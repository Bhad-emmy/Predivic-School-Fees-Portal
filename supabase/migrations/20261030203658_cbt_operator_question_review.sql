-- Permit allowlisted MEKA CBT content operators to inspect one question and
-- its private answer key before publication. Ordinary learners still cannot
-- select private.cbt_question_keys or access this RPC.
create function public.review_cbt_question_for_operator(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if not public.is_cbt_platform_operator() then
    raise exception 'Only approved CBT content operators can review answer keys'
      using errcode='42501';
  end if;

  select jsonb_build_object(
    'id',q.id,
    'exam_type',q.exam_type,
    'subject',q.subject,
    'topic',q.topic,
    'question_text',q.question_text,
    'option_a',q.option_a,
    'option_b',q.option_b,
    'option_c',q.option_c,
    'option_d',q.option_d,
    'correct_option',k.correct_option,
    'explanation',k.explanation,
    'content_origin',q.content_origin,
    'license_reference',q.license_reference,
    'is_free_preview',q.is_free_preview,
    'is_published',q.is_published
  ) into v_result
  from public.cbt_questions q
  join private.cbt_question_keys k on k.question_id=q.id
  where q.id=p_question_id;

  if v_result is null then
    raise exception 'Question not found or missing private answer key';
  end if;
  return v_result;
end;
$$;
revoke all on function public.review_cbt_question_for_operator(uuid)
from public, anon;
grant execute on function public.review_cbt_question_for_operator(uuid)
to authenticated;
