-- Sub-project #3 — service_role grants on the act schema.
--
-- Foundation revoked all schema privileges by default. service_role bypasses
-- RLS (BYPASSRLS) but still needs USAGE on the schema and table-level grants
-- to write. This mirrors sat's 20260521040000_sat_service_role_grants.sql.

grant usage on schema act to service_role;
grant all on all tables in schema act to service_role;
grant all on all sequences in schema act to service_role;
alter default privileges in schema act grant all on tables to service_role;
alter default privileges in schema act grant all on sequences to service_role;
