-- Sub-project #5 — Analytics.
--
-- act.user_analytics() — single security-INVOKER RPC that aggregates the
-- signed-in user's submitted attempts + their per-response correctness
-- into a single jsonb view used by /analytics.
--
-- DESIGN NOTE: This is the inverse posture of the persistence write RPCs.
-- Those are security DEFINER because they need to bypass RLS to write,
-- and they set user_id := auth.uid() themselves. user_analytics is
-- read-only over RLS-protected tables (test_attempts, attempt_responses,
-- questions), so RLS itself confines the result to the caller. We still
-- include `where user_id = auth.uid()` as a clarity backstop.
--
-- Returned shape:
--   { tests_taken, latest_composite, avg_composite, best_composite,
--     trend: [{ attempt_id, submitted_at, composite, scaled_scores, include_science }],
--     sections: { english: { correct, total }, math: {...}, reading: {...}, science: {...} },
--     skills: [{ section, skill, correct, total }] }
--
-- See docs/superpowers/specs/2026-05-26-act-app-analytics-design.md §2.

create or replace function act.user_analytics()
returns jsonb
language plpgsql
security invoker
set search_path = act, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
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
    where user_id = v_user
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
    where a.user_id = v_user
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

revoke execute on function act.user_analytics() from public;
grant execute on function act.user_analytics() to authenticated;
