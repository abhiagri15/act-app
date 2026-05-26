-- Foundation — act.attempt_responses.
-- One row per question presented in a test. See spec §3.6.

create table if not exists act.attempt_responses (
  attempt_id   uuid not null references act.test_attempts(id) on delete cascade,
  question_id  uuid not null references act.questions(id) on delete restrict,
  section      text not null check (section in ('english', 'math', 'reading', 'science')),
  selected     text check (selected is null or selected in ('A', 'B', 'C', 'D')),
  is_correct   boolean,
  -- In-test flag set by the user during the section (palette flag button).
  -- Persisted past section lock so the post-test review can surface
  -- "questions you flagged during the test". Distinct from act.question_flags
  -- which is the bad-question report system (sub-project #7).
  flagged      boolean not null default false,
  answered_at  timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index attempt_responses_attempt_section_idx
  on act.attempt_responses (attempt_id, section);

alter table act.attempt_responses enable row level security;

-- Select-only RLS; ownership inferred via the parent attempt.
create policy "attempt_responses_select_own" on act.attempt_responses
  for select to authenticated
  using (
    exists (
      select 1 from act.test_attempts a
      where a.id = attempt_responses.attempt_id
        and a.user_id = (select auth.uid())
    )
  );

grant select on act.attempt_responses to authenticated;
