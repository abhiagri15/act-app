-- Scoring calibration + skip empty passages.
--
-- Problem: act.score_scales is keyed on the CONFIGURED section length
-- (english 50, math 45, reading 36, science 40), but draw_test delivers a
-- VARIABLE number of questions (passages have 4-10 questions each), so a
-- perfect English section (~42 delivered) maxed out around scaled 28, never
-- 36. Reading was worse and some reading passages have 0 questions.
--
-- Fix 1 (_score_and_lock_section): normalize the raw correct-count onto the
-- section's full scale range by proportion, then look up the published
-- raw->scaled curve. A perfect section now maps to the top of the scale (36)
-- regardless of how many questions were delivered, while preserving the
-- ACT-like curve shape. raw_scores still stores the actual correct count.
--
-- Fix 2 (draw_test): only ever pick passages that have >=1 enabled question,
-- and count passages-with-questions in the pool-thinness check.

-- =====================================================================
-- Fix 1 — normalized section scoring.
-- =====================================================================
create or replace function act._score_and_lock_section(
  p_attempt uuid,
  p_section text
)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_raw int;
  v_total int;
  v_scale_max int;
  v_projected int;
  v_scaled int;
  v_section_state jsonb;
begin
  -- Re-resolve is_correct based on stored selections.
  update act.attempt_responses ar
     set is_correct = (ar.selected is not null and ar.selected = q.answer_key)
    from act.questions q
   where ar.attempt_id = p_attempt
     and ar.section = p_section
     and q.id = ar.question_id;

  -- Actual correct count (stored as raw_scores).
  select count(*) into v_raw
    from act.attempt_responses
   where attempt_id = p_attempt
     and section = p_section
     and is_correct = true;

  -- Number of questions actually delivered for this section in this attempt.
  select count(*) into v_total
    from act.attempt_responses
   where attempt_id = p_attempt
     and section = p_section;

  -- Top of the published scale for this section (the configured length).
  select max(raw_score) into v_scale_max
    from act.score_scales
   where section = p_section;

  -- Normalize the raw onto the scale's full range, then look up the curve.
  if v_total is null or v_total = 0 or v_scale_max is null then
    v_projected := 0;
  else
    v_projected := round(v_raw::numeric / v_total * v_scale_max)::int;
  end if;
  if v_projected < 0 then v_projected := 0; end if;
  if v_scale_max is not null and v_projected > v_scale_max then
    v_projected := v_scale_max;
  end if;

  select scaled_score into v_scaled
    from act.score_scales
   where section = p_section and raw_score = v_projected;
  if v_scaled is null then
    -- Defensive fallback: nearest seeded raw.
    select scaled_score into v_scaled
      from act.score_scales
     where section = p_section
     order by abs(raw_score - v_projected) asc
     limit 1;
  end if;

  update act.test_attempts
     set section_state = section_state || jsonb_build_object(
           p_section,
           coalesce(section_state -> p_section, '{}'::jsonb)
             || jsonb_build_object(
                  'submitted_at', now(),
                  'locked', true
                )
         ),
         raw_scores = raw_scores || jsonb_build_object(p_section, v_raw),
         scaled_scores = scaled_scores || jsonb_build_object(p_section, v_scaled)
   where id = p_attempt
   returning section_state into v_section_state;

  return jsonb_build_object(
    'section', p_section,
    'raw_score', v_raw,
    'scaled_score', v_scaled,
    'locked', true
  );
end;
$$;

revoke execute on function act._score_and_lock_section(uuid, text) from public;

-- =====================================================================
-- Fix 2 — draw_test: only draw passages that have >=1 enabled question,
-- and count passages-with-questions in the pool-thinness check.
-- (Otherwise identical to 20260529000000: anchor insert + daily limit.)
-- =====================================================================
create or replace function act.draw_test(p_include_science boolean)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_attempt_id uuid;
  v_user_id uuid := auth.uid();
  v_payload jsonb;
  v_english_passages jsonb;
  v_reading_passages jsonb;
  v_science_passages jsonb;
  v_questions jsonb;
  v_required_eng constant int := 5;
  v_required_read constant int := 4;
  v_required_sci constant int := 7;
  v_required_math constant int := 45;
  v_eng_count int;
  v_read_count int;
  v_sci_count int;
  v_math_count int;
  v_today_count int;
  v_daily_limit int;
begin
  if v_user_id is null then
    raise exception 'act.draw_test requires an authenticated user';
  end if;

  select daily_attempt_limit into v_daily_limit
    from act.app_config where id = 1;
  if v_daily_limit is null then
    v_daily_limit := 5;
  end if;

  select count(*) into v_today_count
    from act.test_attempts
    where user_id = v_user_id
      and started_at >= date_trunc('day', now() at time zone 'utc')
      and status in ('in_progress', 'submitted');

  if v_today_count >= v_daily_limit then
    raise exception 'daily attempt limit reached (% / %)', v_today_count, v_daily_limit;
  end if;

  -- Pool-thinness check: count only passages that have >=1 enabled question.
  select count(*) into v_eng_count
    from act.passages p where p.section = 'english' and p.enabled
      and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled);
  select count(*) into v_read_count
    from act.passages p where p.section = 'reading' and p.enabled
      and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled);
  if p_include_science then
    select count(*) into v_sci_count
      from act.passages p where p.section = 'science' and p.enabled
        and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled);
  else
    v_sci_count := 0;
  end if;
  select count(*) into v_math_count
    from act.questions
    where enabled and section = 'math' and passage_id is null;

  if v_eng_count < v_required_eng
     or v_read_count < v_required_read
     or v_math_count < v_required_math
     or (p_include_science and v_sci_count < v_required_sci) then
    raise exception 'act pool too thin: need >=% english, >=% reading, >=% math%; have % english, % reading, % science, % math. Run /api/admin/warm-pool.',
      v_required_eng, v_required_read, v_required_math,
      case when p_include_science then ', >=' || v_required_sci || ' science' else '' end,
      v_eng_count, v_read_count, v_sci_count, v_math_count;
  end if;

  -- 1. English: 5 passages with no-repeat-per-user, must have questions.
  with previously_used as (
    select distinct q.passage_id
    from act.attempt_responses ar
    join act.questions q on q.id = ar.question_id
    join act.test_attempts a on a.id = ar.attempt_id
    where a.user_id = v_user_id and q.passage_id is not null
  ),
  pool as (
    select p.id, p.section, p.passage_type, p.title, p.body, p.stimuli
    from act.passages p
    where p.enabled and p.section = 'english'
      and p.id not in (select passage_id from previously_used where passage_id is not null)
      and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
    order by random() limit v_required_eng
  )
  select jsonb_agg(to_jsonb(p.*)) into v_english_passages from pool p;

  if coalesce(jsonb_array_length(v_english_passages), 0) < v_required_eng then
    select jsonb_agg(to_jsonb(p.*))
    into v_english_passages
    from (
      select id, section, passage_type, title, body, stimuli
      from act.passages p
      where p.enabled and p.section = 'english'
        and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
      order by random() limit v_required_eng
    ) p;
  end if;

  -- 2. Reading: 4 passages, one per passage_type, must have questions.
  with picked as (
    select distinct on (passage_type) id, section, passage_type, title, body, stimuli
    from act.passages p
    where p.enabled and p.section = 'reading'
      and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
    order by passage_type, random()
  )
  select jsonb_agg(to_jsonb(p.*)) into v_reading_passages from picked p;

  -- 3. Science: 3 data_rep + 3 research + 1 viewpoints, each must have questions.
  if p_include_science then
    with picked as (
      (select id, section, passage_type, title, body, stimuli from act.passages p
        where p.enabled and p.section = 'science' and p.passage_type = 'data_representation'
          and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
        order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages p
        where p.enabled and p.section = 'science' and p.passage_type = 'research_summaries'
          and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
        order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages p
        where p.enabled and p.section = 'science' and p.passage_type = 'conflicting_viewpoints'
          and exists (select 1 from act.questions q where q.passage_id = p.id and q.enabled)
        order by random() limit 1)
    )
    select jsonb_agg(to_jsonb(p.*)) into v_science_passages from picked p;
  else
    v_science_passages := '[]'::jsonb;
  end if;

  -- 4. Create the attempt row.
  insert into act.test_attempts (
    user_id, include_science, status, section_state, raw_scores, scaled_scores
  )
  values (v_user_id, p_include_science, 'in_progress', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
  returning id into v_attempt_id;

  -- 5. Pre-populate blank attempt_responses rows for every drawn question.
  with all_passages as (
    select (p->>'id')::uuid as id from jsonb_array_elements(coalesce(v_english_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid from jsonb_array_elements(coalesce(v_reading_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid from jsonb_array_elements(coalesce(v_science_passages, '[]'::jsonb)) p
  ),
  drawn_questions as (
    select q.id, q.section
      from act.questions q
      join all_passages ap on ap.id = q.passage_id
     where q.enabled
    union all
    select id, 'math'::text as section
      from (
        select id from act.questions
        where enabled and section = 'math' and passage_id is null
        order by random() limit v_required_math
      ) m
  )
  insert into act.attempt_responses (attempt_id, question_id, section, selected, flagged)
  select v_attempt_id, dq.id, dq.section, null, false from drawn_questions dq
  on conflict (attempt_id, question_id) do nothing;

  -- 6. Build the questions payload from the persisted set.
  with all_passages as (
    select (p->>'id')::uuid as id, p->>'section' as section
    from jsonb_array_elements(coalesce(v_english_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid, p->>'section'
    from jsonb_array_elements(coalesce(v_reading_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid, p->>'section'
    from jsonb_array_elements(coalesce(v_science_passages, '[]'::jsonb)) p
  ),
  passage_questions as (
    select
      q.id as question_id, q.section, q.passage_id, q.passage_marker, q.stem, q.choices
    from act.questions q
    join all_passages ap on ap.id = q.passage_id
    join act.attempt_responses ar on ar.question_id = q.id and ar.attempt_id = v_attempt_id
    where q.enabled
  ),
  math_questions as (
    select q.id as question_id, 'math'::text as section,
           null::uuid as passage_id, null::smallint as passage_marker,
           q.stem, q.choices
    from act.questions q
    join act.attempt_responses ar on ar.question_id = q.id and ar.attempt_id = v_attempt_id
    where q.enabled and q.section = 'math' and q.passage_id is null
  )
  select jsonb_build_object(
    'english', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'passage_marker', passage_marker, 'stem', stem, 'choices', choices
      ))
      from (
        select * from passage_questions where section = 'english'
        order by passage_id, passage_marker
      ) eng
    ), '[]'::jsonb),
    'math', coalesce((select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'stem', stem, 'choices', choices
      )) from math_questions), '[]'::jsonb),
    'reading', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'stem', stem, 'choices', choices
      ))
      from (select * from passage_questions where section = 'reading'
            order by passage_id) r
    ), '[]'::jsonb),
    'science', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'stem', stem, 'choices', choices
      ))
      from (select * from passage_questions where section = 'science'
            order by passage_id) s
    ), '[]'::jsonb)
  ) into v_questions;

  v_payload := jsonb_build_object(
    'attempt_id', v_attempt_id,
    'include_science', p_include_science,
    'passages', coalesce(v_english_passages, '[]'::jsonb)
                || coalesce(v_reading_passages, '[]'::jsonb)
                || coalesce(v_science_passages, '[]'::jsonb),
    'sections', v_questions
  );

  return v_payload;
end;
$$;

revoke execute on function act.draw_test(boolean) from public;
grant execute on function act.draw_test(boolean) to authenticated;
