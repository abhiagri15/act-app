-- Fix ambiguous "role" column reference in admin RPCs.
--
-- Both act.admin_users_summary() and act.admin_user_analytics(uuid) had a
-- bug: their internal role check did
--   (select role from act.profiles where id = auth.uid())
-- but the function signature has `role text` in either RETURNS TABLE
-- (admin_users_summary) or the table-output column space, so PostgreSQL
-- could not disambiguate which `role` was meant and raised
--   42702: column reference "role" is ambiguous
-- This blew up every call to the RPC at runtime, so listUsersWithStats()
-- caught the error and returned [], making /admin/users appear empty.
--
-- Fix: qualify the column reference with the table alias (act.profiles.role).
-- That tells the parser the inner select's `role` is the column, not the
-- output-table column of the same name.

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
  if (select p.role from act.profiles p where p.id = auth.uid()) is distinct from 'admin' then
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

create or replace function act.admin_user_analytics(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if (select p.role from act.profiles p where p.id = auth.uid()) is distinct from 'admin' then
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
