-- Foundation — act.test_attempts.
-- Holds the full mutable state of an in-progress attempt; survives refresh.
-- See spec §3.5 + §4 (state machine).

create table if not exists act.test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  status          text not null default 'in_progress'
                  check (status in ('in_progress', 'submitted', 'abandoned')),
  include_science boolean not null default true,
  current_section text check (current_section in (
    'english', 'math', 'break', 'reading', 'science'
  )),
  section_state   jsonb not null default '{}'::jsonb,
  raw_scores      jsonb not null default '{}'::jsonb,
  scaled_scores   jsonb not null default '{}'::jsonb,
  composite       smallint check (composite is null or composite between 1 and 36)
);

create index test_attempts_user_started_idx
  on act.test_attempts (user_id, started_at desc);

create index test_attempts_user_status_idx
  on act.test_attempts (user_id, status);

alter table act.test_attempts enable row level security;

-- Select-only RLS scoped to the owner. Writes go through security-definer
-- RPCs (act.draw_test, act.start_section, act.submit_section,
-- act.force_lock_section, act.finalize_attempt) — added in sub-projects
-- #3 and #4.
create policy "test_attempts_select_own" on act.test_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on act.test_attempts to authenticated;
