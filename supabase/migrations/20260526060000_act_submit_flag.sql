-- Feedback sub-project (#7) — act.submit_flag RPC.
-- act.question_flags has RLS enabled with NO POLICIES — direct writes from
-- the anon/authenticated role are denied. Users file flags through this
-- security-definer function, which sets user_id := auth.uid() itself.
-- Reason is whitelisted at the SQL layer; an invalid reason raises.

create or replace function act.submit_flag(p_question uuid, p_reason text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authenticated user required';
  end if;
  if p_reason not in ('incorrect_answer', 'ambiguous', 'typo', 'other') then
    raise exception 'invalid reason: %', p_reason;
  end if;
  if not exists (select 1 from act.questions where id = p_question) then
    raise exception 'question not found';
  end if;

  insert into act.question_flags (user_id, question_id, reason, notes, status)
  values (v_user, p_question, p_reason, p_notes, 'open')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function act.submit_flag(uuid, text, text) from public;
grant execute on function act.submit_flag(uuid, text, text) to authenticated;
