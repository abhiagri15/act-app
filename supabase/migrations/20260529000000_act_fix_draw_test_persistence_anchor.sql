-- Hotfix — restore act.draw_test's attempt_responses persistence anchor.
--
-- REGRESSION: migration 20260526050000 (sub-project #6) re-created
-- act.draw_test from the OLD 20260526020000 body to add the daily-attempt
-- limit, and in doing so dropped the blank-attempt_responses pre-populate
-- step that 20260526030000 (sub-project #4) had introduced.
--
-- Consequence: draw_test created the attempt row but inserted ZERO
-- attempt_responses rows. Since NewTestForm discards the RPC payload and
-- act.get_my_attempt reconstructs the question + passage set purely by
-- joining through attempt_responses, every section of every attempt
-- rendered as "0 of 0 answered" / "No passage."
--
-- This migration redefines draw_test = the known-good 030000 body
-- (which inserts the persistence anchor AND builds the payload from it)
-- PLUS the daily-attempt-limit check from 050000.

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

  -- Daily attempt limit (sub-project #6). Check BEFORE pool-thinness so a
  -- capped user gets a clear "daily limit reached" rather than the
  -- generic "pool too thin" message. Abandoned attempts don't count.
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

  -- Buffer checks. Friendly exception messages so the UI can surface the
  -- "pool still warming" state without exposing internals.
  select count(*) into v_eng_count
    from act.passages where section = 'english' and enabled;
  select count(*) into v_read_count
    from act.passages where section = 'reading' and enabled;
  if p_include_science then
    select count(*) into v_sci_count
      from act.passages where section = 'science' and enabled;
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

  -- 1. English: 5 passages with no-repeat-per-user.
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
    order by random() limit v_required_eng
  )
  select jsonb_agg(to_jsonb(p.*)) into v_english_passages from pool p;

  if coalesce(jsonb_array_length(v_english_passages), 0) < v_required_eng then
    select jsonb_agg(to_jsonb(p.*))
    into v_english_passages
    from (
      select id, section, passage_type, title, body, stimuli
      from act.passages
      where enabled and section = 'english'
      order by random() limit v_required_eng
    ) p;
  end if;

  -- 2. Reading.
  with picked as (
    select distinct on (passage_type) id, section, passage_type, title, body, stimuli
    from act.passages
    where enabled and section = 'reading'
    order by passage_type, random()
  )
  select jsonb_agg(to_jsonb(p.*)) into v_reading_passages from picked p;

  -- 3. Science.
  if p_include_science then
    with picked as (
      (select id, section, passage_type, title, body, stimuli from act.passages
        where enabled and section = 'science' and passage_type = 'data_representation'
        order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages
        where enabled and section = 'science' and passage_type = 'research_summaries'
        order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages
        where enabled and section = 'science' and passage_type = 'conflicting_viewpoints'
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
  -- This is the persistence anchor — act.get_my_attempt joins back through
  -- attempt_responses to materialize the full question+passage payload on
  -- both resume and review.
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
