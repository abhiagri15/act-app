-- Foundation — act.question_flags.
-- User-reported bad-question reports. Mirrors sat.question_flags posture:
-- RLS ENABLED with NO POLICIES — direct anon/authenticated read+write denied.
-- Users file via security-definer act.submit_flag (sub-project #7).
-- Admins read/resolve via service-role client behind requireAdmin().

create table if not exists act.question_flags (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  uuid not null references act.questions(id) on delete cascade,
  reason       text not null check (reason in ('incorrect_answer', 'ambiguous', 'typo', 'other')),
  notes        text,
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index question_flags_status_idx on act.question_flags (status);
create index question_flags_question_idx on act.question_flags (question_id);

alter table act.question_flags enable row level security;
-- No policies = no direct access for anon/authenticated. Deliberate.
