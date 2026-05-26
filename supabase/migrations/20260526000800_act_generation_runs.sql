-- Foundation — act.generation_runs.
-- n8n + Vercel cron bookkeeping. See spec §3.9.

create table if not exists act.generation_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  skill        text,
  target       int,
  produced     int not null default 0,
  errors       jsonb not null default '[]'::jsonb
);

create index generation_runs_started_idx on act.generation_runs (started_at desc);

alter table act.generation_runs enable row level security;
-- No policies. Read by service-role client (sub-project #6 admin).
