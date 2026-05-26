-- Foundation sub-project — creates the `act` schema with deny-by-default RLS.
-- Tables defined in subsequent migrations:
--   act.profiles, act.passages, act.questions,
--   act.test_attempts, act.attempt_responses,
--   act.score_scales, act.question_flags, act.generation_runs.

create schema if not exists act;

-- Deny-by-default for Supabase roles AND the implicit PUBLIC role,
-- so future SECURITY DEFINER functions don't inherit EXECUTE accidentally.
revoke all on schema act from anon, authenticated, public;
grant usage on schema act to anon, authenticated;

alter default privileges in schema act
  revoke all on tables from anon, authenticated, public;
alter default privileges in schema act
  revoke all on sequences from anon, authenticated, public;
alter default privileges in schema act
  revoke all on functions from anon, authenticated, public;
