-- Hotfix — get_my_attempt must return choices as a string[] (text only).
--
-- act.questions.choices is stored as a jsonb array of OBJECTS
-- ([{"key":"A","text":"..."}, ...]), but the test-runner zod schema
-- (attemptQuestionSchema.choices = z.array(z.string())) and the renderers
-- (QuestionPane / ReviewItem map choices.map((text, i) => ...), deriving the
-- A/B/C/D letter from position) both expect a flat array of strings.
--
-- Before the draw_test persistence-anchor fix (20260529000000), get_my_attempt
-- returned an EMPTY questions array (no attempt_responses), so the per-question
-- schema rule never fired. Once questions started flowing, every question
-- failed z.array(z.string()) -> getMyAttempt() returned null -> the
-- /test/[attemptId] layout called notFound() -> hard 404 right after "Start".
--
-- Fix: emit choices as an ordered array of the choice texts. Defensive against
-- a future string[] storage shape (passes scalars through unchanged).

create or replace function act.get_my_attempt(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = act, public, pg_temp
as $$
declare
  v_attempt act.test_attempts%rowtype;
  v_in_progress boolean;
  v_passages jsonb;
  v_questions jsonb;
  v_responses jsonb;
begin
  select * into v_attempt from act.test_attempts where id = p_id;
  if not found then
    return null;
  end if;
  v_in_progress := v_attempt.status = 'in_progress';

  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id', p.id,
    'section', p.section,
    'passage_type', p.passage_type,
    'title', p.title,
    'body', p.body,
    'stimuli', p.stimuli
  )), '[]'::jsonb) into v_passages
    from act.passages p
   where p.id in (
     select distinct q.passage_id
       from act.attempt_responses ar
       join act.questions q on q.id = ar.question_id
      where ar.attempt_id = p_id
        and q.passage_id is not null
   );

  if v_in_progress then
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'section', q.section, 'skill', q.skill,
      'passage_id', q.passage_id, 'passage_marker', q.passage_marker,
      'stem', q.stem,
      'choices', coalesce((
        select jsonb_agg(
                 case when jsonb_typeof(elem) = 'object' then elem->>'text' else elem #>> '{}' end
                 order by ord
               )
        from jsonb_array_elements(q.choices) with ordinality as t(elem, ord)
      ), '[]'::jsonb)
    )), '[]'::jsonb) into v_questions
      from act.questions q
      join act.attempt_responses ar on ar.question_id = q.id
     where ar.attempt_id = p_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'section', q.section, 'skill', q.skill,
      'passage_id', q.passage_id, 'passage_marker', q.passage_marker,
      'stem', q.stem,
      'choices', coalesce((
        select jsonb_agg(
                 case when jsonb_typeof(elem) = 'object' then elem->>'text' else elem #>> '{}' end
                 order by ord
               )
        from jsonb_array_elements(q.choices) with ordinality as t(elem, ord)
      ), '[]'::jsonb),
      'answer_key', q.answer_key, 'explanation', q.explanation
    )), '[]'::jsonb) into v_questions
      from act.questions q
      join act.attempt_responses ar on ar.question_id = q.id
     where ar.attempt_id = p_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', ar.question_id,
    'section', ar.section,
    'selected', ar.selected,
    'flagged', ar.flagged,
    'is_correct', case when v_in_progress then null else ar.is_correct end,
    'answered_at', ar.answered_at
  )), '[]'::jsonb) into v_responses
    from act.attempt_responses ar
   where ar.attempt_id = p_id;

  return jsonb_build_object(
    'id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'started_at', v_attempt.started_at,
    'submitted_at', v_attempt.submitted_at,
    'status', v_attempt.status,
    'include_science', v_attempt.include_science,
    'current_section', v_attempt.current_section,
    'section_state', v_attempt.section_state,
    'raw_scores', case when v_in_progress then '{}'::jsonb else v_attempt.raw_scores end,
    'scaled_scores', case when v_in_progress then '{}'::jsonb else v_attempt.scaled_scores end,
    'composite', v_attempt.composite,
    'passages', v_passages,
    'questions', v_questions,
    'responses', v_responses
  );
end;
$$;

revoke execute on function act.get_my_attempt(uuid) from public;
grant execute on function act.get_my_attempt(uuid) to authenticated;
