-- Foundation — act.questions.
-- Question pool. References act.passages for English/Reading/Science items
-- (NULL passage_id only for Math). See spec §3.3.

create table if not exists act.questions (
  id              uuid primary key default gen_random_uuid(),
  section         text not null check (section in ('english', 'math', 'reading', 'science')),
  skill           text not null,
  difficulty      smallint not null default 3 check (difficulty between 1 and 5),
  passage_id      uuid references act.passages(id) on delete cascade,
  passage_marker  smallint,
  stem            text not null,
  choices         jsonb not null,
  answer_key      text not null check (answer_key in ('A', 'B', 'C', 'D')),
  explanation     text not null,
  enabled         boolean not null default true,
  dedup_hash      text unique,
  created_at      timestamptz not null default now()
);

-- Per-section skill check. Mirrors SKILLS in app/lib/act/format.ts.
alter table act.questions add constraint questions_section_skill_match check (
  (section = 'english' and skill in (
    'production_of_writing', 'knowledge_of_language', 'conventions_of_standard_english'
  ))
  or (section = 'math' and skill in (
    'preparing_for_higher_math', 'integrating_essential_skills', 'modeling'
  ))
  or (section = 'reading' and skill in (
    'key_ideas_and_details', 'craft_and_structure', 'integration_of_knowledge'
  ))
  or (section = 'science' and skill in (
    'interpretation_of_data', 'scientific_investigation', 'evaluation_of_models'
  ))
);

-- passage_id presence rule: required for english/reading/science, null for math.
alter table act.questions add constraint questions_passage_required check (
  (section = 'math' and passage_id is null and passage_marker is null)
  or (section in ('english', 'reading', 'science') and passage_id is not null)
);

-- passage_marker is English-only.
alter table act.questions add constraint questions_marker_english_only check (
  (section = 'english' and passage_marker is not null)
  or (section <> 'english' and passage_marker is null)
);

create index questions_section_skill_enabled_idx
  on act.questions (section, skill)
  where enabled;

create index questions_passage_idx
  on act.questions (passage_id)
  where passage_id is not null;

alter table act.questions enable row level security;

-- Select-only RLS. Writes go through security-definer RPCs (sub-project #3)
-- or the service-role client (sub-project #6 admin).
create policy "questions_select_authenticated" on act.questions
  for select to authenticated
  using (enabled);

grant select on act.questions to authenticated;

-- dedup_hash auto-fill trigger.
create or replace function act.questions_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.dedup_hash is null then
    -- Per spec §3.10: sha256 of section + skill + stem + choices.
    -- Two questions with the same stem+choices but different passages would
    -- collide intentionally (still a duplicate question, regardless of which
    -- passage it references). passage_id is deliberately excluded.
    new.dedup_hash := encode(
      digest(
        new.section || '|' || new.skill || '|' || new.stem || '|' || (new.choices::text),
        'sha256'
      ),
      'hex'
    );
  end if;
  return new;
end;
$$;

create trigger questions_fill_defaults_trigger
  before insert on act.questions
  for each row execute function act.questions_fill_defaults();
