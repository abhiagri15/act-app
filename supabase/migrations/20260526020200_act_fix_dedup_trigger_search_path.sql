-- Sub-project #3 — fix for the foundation followup's overly-narrow search_path.
--
-- 20260526010000_act_foundation_followups.sql set the dedup-hash triggers'
-- search_path to (act, public, pg_temp), with a comment claiming pgcrypto's
-- digest() lives in `public`. On Supabase it actually lives in `extensions`,
-- so passage and question inserts blew up with
--   42883 function digest(text, unknown) does not exist
-- as soon as we tried to insert from sub-project #3 (Foundation never tested
-- an insert; only the schema definition).
--
-- Adding `extensions` to the search_path resolves the lookup without changing
-- the trigger bodies.

alter function act.passages_fill_defaults()
  set search_path = act, public, extensions, pg_temp;

alter function act.questions_fill_defaults()
  set search_path = act, public, extensions, pg_temp;
