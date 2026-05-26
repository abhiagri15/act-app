-- Sub-project #2 (Auth) pre-flight: clears Supabase advisor warnings
-- from Foundation. No schema changes — just function security posture.

-- 1. protect_profile_role: gratuitously SECURITY DEFINER. Trigger context
-- doesn't need elevated privileges. Match sat.protect_profile_role posture.
alter function act.protect_profile_role() security invoker;
revoke execute on function act.protect_profile_role() from public;

-- 2. set_updated_at: lock search_path against extension shadowing.
alter function act.set_updated_at() set search_path = act, pg_temp;

-- 3. passages_fill_defaults: lock search_path. Uses digest() from pgcrypto,
-- which lives in public, so include public in the path.
alter function act.passages_fill_defaults() set search_path = act, public, pg_temp;

-- 4. questions_fill_defaults: same.
alter function act.questions_fill_defaults() set search_path = act, public, pg_temp;
