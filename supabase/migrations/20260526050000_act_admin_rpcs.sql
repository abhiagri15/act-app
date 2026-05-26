-- Sub-project #6 — Admin RPCs + app_config + draw_test amendment.
--
-- Adds:
--   * act.app_config — single-row table with the daily attempt limit.
--   * act.admin_users_summary() — security-definer; internal role check
--     ensures only admins get rows.
--   * act.admin_user_analytics(p_user_id) — security-definer; mirrors
--     act.user_analytics() but filters by the specified user.
--   * Amends act.draw_test(p_include_science boolean) to enforce
--     daily_attempt_limit BEFORE the pool-thinness check (so users hit
--     the daily cap before getting a "pool too thin" message).
--
-- All admin reads/writes also re-gate behind requireAdmin() in the app —
-- this RPC's role check is the second layer of defense.

-- ============================================================
-- act.app_config (single-row settings table)
-- ============================================================

create table if not exists act.app_config (
  id                   integer primary key default 1 check (id = 1),
  daily_attempt_limit  integer not null default 5 check (daily_attempt_limit > 0),
  updated_at           timestamptz not null default now()
);

insert into act.app_config (id) values (1) on conflict do nothing;

alter table act.app_config enable row level security;

-- The daily limit is not secret — authenticated users read it to decide
-- whether to surface a friendly "limit reached" message. Writes go through
-- the service-role client behind requireAdmin() (no write policy).
drop policy if exists "app_config_select_authenticated" on act.app_config;
create policy "app_config_select_authenticated" on act.app_config
  for select to authenticated
  using (true);

grant select on act.app_config to authenticated;

-- Keep updated_at fresh. act.set_updated_at() was introduced in the profiles
-- migration; reuse it here.
drop trigger if exists app_config_set_updated_at on act.app_config;
create trigger app_config_set_updated_at
  before update on act.app_config
  for each row execute function act.set_updated_at();

-- ============================================================
-- act.admin_users_summary() — admin users list with stats
-- ============================================================

create or replace function act.admin_users_summary()
returns table (
  user_id          uuid,
  email            text,
  full_name        text,
  role             text,
  tests_taken      int,
  avg_composite    numeric,
  latest_activity  timestamptz
)
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
begin
  -- In-function role check — the layout-level requireAdmin() is the first
  -- gate; this is the airtight backstop in case a non-admin reaches this
  -- function some other way.
  if (select role from act.profiles where id = auth.uid()) is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  return query
    select
      p.id,
      p.email,
      p.full_name,
      p.role,
      coalesce(count(a.id) filter (where a.status = 'submitted'), 0)::int as tests_taken,
      round(avg(a.composite) filter (where a.status = 'submitted')::numeric, 1) as avg_composite,
      greatest(p.updated_at, max(a.submitted_at) filter (where a.status = 'submitted')) as latest_activity
    from act.profiles p
    left join act.test_attempts a on a.user_id = p.id
    group by p.id
    order by latest_activity desc nulls last;
end;
$$;

revoke execute on function act.admin_users_summary() from public;
grant execute on function act.admin_users_summary() to authenticated;

-- ============================================================
-- act.admin_user_analytics(p_user_id) — per-user analytics view
-- ============================================================

create or replace function act.admin_user_analytics(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if (select role from act.profiles where id = auth.uid()) is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  if p_user_id is null then
    return null;
  end if;

  with attempts as (
    select id,
           started_at,
           submitted_at,
           status,
           composite,
           scaled_scores,
           include_science
    from act.test_attempts
    where user_id = p_user_id
      and status = 'submitted'
    order by submitted_at desc
  ),
  responses as (
    select ar.section,
           q.skill,
           ar.is_correct
    from act.attempt_responses ar
    join act.questions q on q.id = ar.question_id
    join act.test_attempts a on a.id = ar.attempt_id
    where a.user_id = p_user_id
      and a.status = 'submitted'
  ),
  by_skill as (
    select section,
           skill,
           count(*) filter (where is_correct) as correct,
           count(*) as total
    from responses
    group by section, skill
  ),
  by_section as (
    select section,
           count(*) filter (where is_correct) as correct,
           count(*) as total
    from responses
    group by section
  )
  select jsonb_build_object(
    'tests_taken', (select count(*) from attempts),
    'latest_composite', (select composite from attempts limit 1),
    'avg_composite', (select round(avg(composite)::numeric, 1) from attempts),
    'best_composite', (select max(composite) from attempts),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', id,
        'submitted_at', submitted_at,
        'composite', composite,
        'scaled_scores', scaled_scores,
        'include_science', include_science
      ) order by submitted_at desc)
      from attempts
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_object_agg(
        section,
        jsonb_build_object('correct', correct, 'total', total)
      )
      from by_section
    ), '{}'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'section', section,
        'skill', skill,
        'correct', correct,
        'total', total
      ))
      from by_skill
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function act.admin_user_analytics(uuid) from public;
grant execute on function act.admin_user_analytics(uuid) to authenticated;

-- ============================================================
-- Amend act.draw_test — enforce daily_attempt_limit
-- ============================================================
-- The daily-cap check runs BEFORE the pool-thinness check, so users hit
-- the cap before getting a confusing "pool too thin" message.
--
-- Today's attempts = test_attempts started since the UTC midnight, in
-- ('in_progress', 'submitted') statuses. Abandoned attempts don't count
-- against the cap (a connection failure shouldn't burn an attempt).

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
  -- generic "pool too thin" message.
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

  -- 1. Pick 5 random enabled English passages with no-repeat-per-user.
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

  -- Fallback: if no-repeat filter starved the pool, allow repeats.
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

  -- 2. Reading: 4 passages, one per passage_type (literary, social, humanities, natural).
  with picked as (
    select distinct on (passage_type) id, section, passage_type, title, body, stimuli
    from act.passages
    where enabled and section = 'reading'
    order by passage_type, random()
  )
  select jsonb_agg(to_jsonb(p.*)) into v_reading_passages from picked p;

  -- 3. Science (optional): the 3+3+1 mix.
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

  -- 5. Build the questions payload. Stem + choices only; answer_key stripped.
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
    where q.enabled
  ),
  math_questions as (
    select id as question_id, 'math' as section,
           null::uuid as passage_id, null::smallint as passage_marker,
           stem, choices
    from act.questions
    where enabled and section = 'math' and passage_id is null
    order by random() limit v_required_math
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

  -- 6. Final payload.
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
