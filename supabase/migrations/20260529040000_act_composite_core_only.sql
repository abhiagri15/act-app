-- Enhanced ACT composite: average of the three CORE sections only
-- (English, Reading, Math). Science is still required (when included),
-- scored, and reported as its own section score, but it does NOT factor
-- into the 1-36 composite -- matching the 2025 Enhanced ACT, where the
-- composite is the mean of English/Reading/Math and Science is separate.
--
-- DB-only change; runs only at finalize. Safe to apply mid-test.

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
  v_core constant text[] := array['english','math','reading'];
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

  -- Science is still required to be completed when included in the attempt...
  if v_attempt.include_science then
    v_required := array_append(v_required, 'science');
  end if;

  foreach v_section in array v_required loop
    if not coalesce(((v_attempt.section_state -> v_section)->>'locked')::boolean, false) then
      raise exception 'section % is not yet locked', v_section;
    end if;
  end loop;

  -- ...but the composite is the mean of the CORE three only (Science excluded).
  foreach v_section in array v_core loop
    v_included := array_append(v_included, (v_attempt.scaled_scores->>v_section)::numeric);
  end loop;

  v_composite := round((select avg(s) from unnest(v_included) as s))::smallint;
  if v_composite < 1 then v_composite := 1; end if;
  if v_composite > 36 then v_composite := 36; end if;

  update act.test_attempts
     set status = 'submitted',
         submitted_at = now(),
         composite = v_composite,
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
