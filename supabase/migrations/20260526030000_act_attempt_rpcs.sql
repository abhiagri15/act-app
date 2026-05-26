-- Sub-project #4 — Persistence + Test Runner.
-- 7 RPCs for the test-taking flow:
--   * 5 security-definer writes:
--       act.start_section, act.submit_section, act.force_lock_section,
--       act.finalize_attempt, act.upsert_response
--   * 2 security-invoker reads:
--       act.list_my_attempts, act.get_my_attempt
--
-- All functions: search_path locked to (act, public, pg_temp).
-- Grant EXECUTE to authenticated; revoke from PUBLIC.
--
-- ALSO: updates act.draw_test to pre-populate blank attempt_responses
-- rows for every drawn question, so act.get_my_attempt can resolve the
-- full question/passage set via a join (no need to cache the draw
-- payload client-side).
--
-- See spec docs/superpowers/specs/2026-05-26-act-app-persistence-design.md §2.

-- =====================================================================
-- act.draw_test — REDEFINED to pre-populate attempt_responses with
-- one blank row per drawn question, so the persistence layer can
-- always reconstruct the drawn pool via attempt_responses + questions
-- joins (used by act.get_my_attempt for resume + review).
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
begin
  if v_user_id is null then
    raise exception 'act.draw_test requires an authenticated user';
  end if;

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

  -- 6. Build the questions payload.
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

-- =====================================================================
-- act.start_section(p_attempt uuid, p_section text) returns void
--
-- Sets section_state[p_section] = { started_at, ends_at, submitted_at,
-- locked }; updates test_attempts.current_section. Idempotent if the
-- section is already started AND not yet locked.
-- =====================================================================
create or replace function act.start_section(p_attempt uuid, p_section text)
returns void
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt act.test_attempts%rowtype;
  v_now timestamptz := now();
  v_duration int;
  v_existing jsonb;
begin
  if v_user_id is null then
    raise exception 'act.start_section requires an authenticated user';
  end if;
  if p_section not in ('english','math','break','reading','science') then
    raise exception 'invalid section: %', p_section;
  end if;

  select * into v_attempt from act.test_attempts where id = p_attempt;
  if not found then
    raise exception 'attempt not found';
  end if;
  if v_attempt.user_id <> v_user_id then
    raise exception 'not your attempt';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt is not in progress';
  end if;
  if p_section = 'science' and not v_attempt.include_science then
    raise exception 'science is not included in this attempt';
  end if;

  v_duration := case p_section
    when 'english' then 2100
    when 'math' then 3000
    when 'break' then 600
    when 'reading' then 2400
    when 'science' then 2400
  end;

  v_existing := v_attempt.section_state -> p_section;

  -- Idempotent: if the section is already started and NOT locked, no-op.
  if v_existing is not null and (v_existing->>'locked')::boolean is not true then
    -- Make sure current_section reflects the section being resumed.
    update act.test_attempts
       set current_section = p_section
     where id = p_attempt;
    return;
  end if;

  -- If already locked, refuse — caller should advance, not restart.
  if v_existing is not null and (v_existing->>'locked')::boolean = true then
    raise exception 'section % already locked', p_section;
  end if;

  update act.test_attempts
     set current_section = p_section,
         section_state = section_state || jsonb_build_object(
           p_section,
           jsonb_build_object(
             'started_at', v_now,
             'ends_at',    v_now + (v_duration || ' seconds')::interval,
             'submitted_at', null,
             'locked', false
           )
         )
   where id = p_attempt;
end;
$$;

revoke execute on function act.start_section(uuid, text) from public;
grant execute on function act.start_section(uuid, text) to authenticated;

-- =====================================================================
-- act.upsert_response(p_attempt uuid, p_question uuid, p_selected text,
--                    p_flagged bool) returns void
--
-- Fire-and-forget answer write. Validates ownership, that the section is
-- the current_section, and that the section isn't locked. is_correct
-- stays NULL until submit_section runs.
-- =====================================================================
create or replace function act.upsert_response(
  p_attempt uuid,
  p_question uuid,
  p_selected text,
  p_flagged bool
)
returns void
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt act.test_attempts%rowtype;
  v_question act.questions%rowtype;
  v_section_state jsonb;
begin
  if v_user_id is null then
    raise exception 'act.upsert_response requires an authenticated user';
  end if;
  if p_selected is not null and p_selected not in ('A','B','C','D') then
    raise exception 'invalid selection: %', p_selected;
  end if;

  select * into v_attempt from act.test_attempts where id = p_attempt;
  if not found or v_attempt.user_id <> v_user_id then
    raise exception 'attempt not found';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt is not in progress';
  end if;

  select * into v_question from act.questions where id = p_question;
  if not found then
    raise exception 'question not found';
  end if;
  if v_question.section <> v_attempt.current_section then
    raise exception 'question is not in the current section';
  end if;

  v_section_state := v_attempt.section_state -> v_question.section;
  if v_section_state is null then
    raise exception 'section % not started', v_question.section;
  end if;
  if (v_section_state->>'locked')::boolean = true then
    raise exception 'section % is locked', v_question.section;
  end if;

  insert into act.attempt_responses (attempt_id, question_id, section, selected, flagged, answered_at)
  values (p_attempt, p_question, v_question.section, p_selected, p_flagged, now())
  on conflict (attempt_id, question_id) do update
    set selected    = excluded.selected,
        flagged     = excluded.flagged,
        answered_at = now();
end;
$$;

revoke execute on function act.upsert_response(uuid, uuid, text, bool) from public;
grant execute on function act.upsert_response(uuid, uuid, text, bool) to authenticated;

-- =====================================================================
-- Helper: act._score_and_lock_section
-- Shared by submit_section + force_lock_section. Recomputes is_correct
-- from the stored responses, computes raw + scaled, marks section
-- locked. Returns the section result jsonb. NOT exposed externally.
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

  select count(*) into v_raw
    from act.attempt_responses
   where attempt_id = p_attempt
     and section = p_section
     and is_correct = true;

  select scaled_score into v_scaled
    from act.score_scales
   where section = p_section and raw_score = v_raw;
  if v_scaled is null then
    -- Defensive fallback: clamp raw count to the seeded range.
    select scaled_score into v_scaled
      from act.score_scales
     where section = p_section
     order by abs(raw_score - v_raw) asc
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

-- Helper is NOT exposed to PUBLIC/authenticated; only called from the
-- security-definer functions in this file, which run as the function
-- owner anyway.
revoke execute on function act._score_and_lock_section(uuid, text) from public;

-- =====================================================================
-- act.submit_section(p_attempt uuid, p_section text, p_responses jsonb)
-- returns jsonb
--
-- p_responses shape: [{ question_id, selected, flagged }, ...]
-- Upserts the responses, then scores + locks the section.
-- Rejects submissions more than 10s past the section deadline.
-- =====================================================================
create or replace function act.submit_section(
  p_attempt uuid,
  p_section text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt act.test_attempts%rowtype;
  v_section_state jsonb;
  v_ends_at timestamptz;
  v_response jsonb;
begin
  if v_user_id is null then
    raise exception 'act.submit_section requires an authenticated user';
  end if;

  select * into v_attempt from act.test_attempts where id = p_attempt;
  if not found or v_attempt.user_id <> v_user_id then
    raise exception 'attempt not found';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt is not in progress';
  end if;
  if v_attempt.current_section <> p_section then
    raise exception 'section % is not the current section (%)', p_section, v_attempt.current_section;
  end if;

  v_section_state := v_attempt.section_state -> p_section;
  if v_section_state is null then
    raise exception 'section % not started', p_section;
  end if;
  if (v_section_state->>'locked')::boolean = true then
    raise exception 'section % already locked', p_section;
  end if;

  v_ends_at := (v_section_state->>'ends_at')::timestamptz;
  if v_ends_at is not null and now() > v_ends_at + interval '10 seconds' then
    raise exception 'section deadline missed; call force_lock_section';
  end if;

  -- Upsert each response. p_responses is allowed to be null or empty.
  if jsonb_typeof(p_responses) = 'array' then
    for v_response in select * from jsonb_array_elements(p_responses) loop
      insert into act.attempt_responses (
        attempt_id, question_id, section, selected, flagged, answered_at
      )
      values (
        p_attempt,
        (v_response->>'question_id')::uuid,
        p_section,
        nullif(v_response->>'selected', ''),
        coalesce((v_response->>'flagged')::boolean, false),
        now()
      )
      on conflict (attempt_id, question_id) do update
        set selected = excluded.selected,
            flagged  = excluded.flagged,
            answered_at = now();
    end loop;
  end if;

  return act._score_and_lock_section(p_attempt, p_section);
end;
$$;

revoke execute on function act.submit_section(uuid, text, jsonb) from public;
grant execute on function act.submit_section(uuid, text, jsonb) to authenticated;

-- =====================================================================
-- act.force_lock_section(p_attempt uuid, p_section text) returns jsonb
--
-- Same effect as submit_section but uses whatever responses are ALREADY
-- in act.attempt_responses (no new payload). Idempotent: if already
-- locked, returns the existing stored scores.
-- =====================================================================
create or replace function act.force_lock_section(p_attempt uuid, p_section text)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt act.test_attempts%rowtype;
  v_section_state jsonb;
begin
  if v_user_id is null then
    raise exception 'act.force_lock_section requires an authenticated user';
  end if;

  select * into v_attempt from act.test_attempts where id = p_attempt;
  if not found or v_attempt.user_id <> v_user_id then
    raise exception 'attempt not found';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt is not in progress';
  end if;

  v_section_state := v_attempt.section_state -> p_section;
  if v_section_state is null then
    raise exception 'section % not started', p_section;
  end if;

  if (v_section_state->>'locked')::boolean = true then
    -- Idempotent: return the existing scores.
    return jsonb_build_object(
      'section', p_section,
      'raw_score', coalesce((v_attempt.raw_scores->>p_section)::int, 0),
      'scaled_score', coalesce((v_attempt.scaled_scores->>p_section)::int, 1),
      'locked', true
    );
  end if;

  return act._score_and_lock_section(p_attempt, p_section);
end;
$$;

revoke execute on function act.force_lock_section(uuid, text) from public;
grant execute on function act.force_lock_section(uuid, text) to authenticated;

-- =====================================================================
-- act.finalize_attempt(p_attempt uuid) returns jsonb
--
-- Validates required sections are locked (english + math + reading
-- always; science iff include_science). Computes composite as
-- round(mean(included scaled scores)). Marks the attempt 'submitted'.
-- =====================================================================
create or replace function act.finalize_attempt(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt act.test_attempts%rowtype;
  v_required text[] := array['english','math','reading'];
  v_section text;
  v_included numeric[] := array[]::numeric[];
  v_composite smallint;
begin
  if v_user_id is null then
    raise exception 'act.finalize_attempt requires an authenticated user';
  end if;

  select * into v_attempt from act.test_attempts where id = p_attempt;
  if not found or v_attempt.user_id <> v_user_id then
    raise exception 'attempt not found';
  end if;

  -- Idempotent: if already submitted, return the existing results.
  if v_attempt.status = 'submitted' then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'composite', v_attempt.composite,
      'scaled_scores', v_attempt.scaled_scores,
      'raw_scores', v_attempt.raw_scores,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at,
      'include_science', v_attempt.include_science
    );
  end if;

  if v_attempt.include_science then
    v_required := v_required || 'science';
  end if;

  foreach v_section in array v_required loop
    if not coalesce(((v_attempt.section_state -> v_section)->>'locked')::boolean, false) then
      raise exception 'section % is not yet locked', v_section;
    end if;
    v_included := v_included || (v_attempt.scaled_scores->>v_section)::numeric;
  end loop;

  v_composite := round((select avg(s) from unnest(v_included) as s))::smallint;
  if v_composite < 1 then v_composite := 1; end if;
  if v_composite > 36 then v_composite := 36; end if;

  update act.test_attempts
     set status       = 'submitted',
         submitted_at = now(),
         composite    = v_composite,
         current_section = null
   where id = p_attempt;

  return jsonb_build_object(
    'attempt_id', p_attempt,
    'composite', v_composite,
    'scaled_scores', v_attempt.scaled_scores,
    'raw_scores', v_attempt.raw_scores,
    'started_at', v_attempt.started_at,
    'submitted_at', now(),
    'include_science', v_attempt.include_science
  );
end;
$$;

revoke execute on function act.finalize_attempt(uuid) from public;
grant execute on function act.finalize_attempt(uuid) to authenticated;

-- =====================================================================
-- act.list_my_attempts() returns table(...)
--
-- security invoker — RLS on test_attempts scopes the result to the caller.
-- Newest first; tie-break by id for stability inside the same ms.
-- =====================================================================
create or replace function act.list_my_attempts()
returns table (
  id uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  status text,
  include_science boolean,
  composite smallint
)
language sql
security invoker
set search_path = act, public, pg_temp
as $$
  select a.id, a.started_at, a.submitted_at, a.status,
         a.include_science, a.composite
    from act.test_attempts a
   order by a.started_at desc, a.id desc;
$$;

revoke execute on function act.list_my_attempts() from public;
grant execute on function act.list_my_attempts() to authenticated;

-- =====================================================================
-- act.get_my_attempt(p_id uuid) returns jsonb
--
-- Returns the full attempt + questions + passages + responses bundled.
-- When status = 'in_progress', answer_key + explanation are stripped from
-- each question (the test runner must never see them). When 'submitted',
-- they are included for the review page.
--
-- security invoker — RLS denies if not the caller's attempt.
-- =====================================================================
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
    return null;   -- RLS denies non-owner reads; missing row returns null.
  end if;
  v_in_progress := v_attempt.status = 'in_progress';

  -- Passages used in this attempt: distinct passage_ids referenced from
  -- attempt_responses, OR for a brand-new in-progress attempt where no
  -- responses exist yet, fall back to passages drawn at attempt creation
  -- by joining via act.questions that have a stored response or — for
  -- in_progress attempts before any answer is given — by reading from
  -- the passages currently in the attempt's section payload. Since the
  -- attempt row itself doesn't carry the draw, we derive passages from
  -- the questions actually persisted as responses + passages joined to
  -- the section's enabled questions for that section. For simplicity,
  -- we serve only the passages referenced by attempt_responses; the test
  -- runner draws its full payload from draw_test's return value on the
  -- pre-test screen and caches it client-side. The review page (where
  -- status='submitted') always has every question/passage referenced via
  -- attempt_responses, so the join is sufficient.

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

  -- Questions referenced by attempt_responses for this attempt. Answer
  -- key + explanation gated on status.
  if v_in_progress then
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'section', q.section,
      'skill', q.skill,
      'passage_id', q.passage_id,
      'passage_marker', q.passage_marker,
      'stem', q.stem,
      'choices', q.choices
    )), '[]'::jsonb) into v_questions
      from act.questions q
      join act.attempt_responses ar on ar.question_id = q.id
     where ar.attempt_id = p_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'section', q.section,
      'skill', q.skill,
      'passage_id', q.passage_id,
      'passage_marker', q.passage_marker,
      'stem', q.stem,
      'choices', q.choices,
      'answer_key', q.answer_key,
      'explanation', q.explanation
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
