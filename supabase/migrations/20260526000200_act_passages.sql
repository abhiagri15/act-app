-- Foundation — act.passages.
-- Shared passage pool for English / Reading / Science. Multiple act.questions
-- rows point to the same passage via passage_id. See spec §3.2.

create table if not exists act.passages (
  id            uuid primary key default gen_random_uuid(),
  section       text not null check (section in ('english', 'reading', 'science')),
  passage_type  text not null check (passage_type in (
    'english_essay',
    'literary_narrative', 'social_science', 'humanities', 'natural_science',
    'data_representation', 'research_summaries', 'conflicting_viewpoints'
  )),
  title         text,
  body          text not null,
  stimuli       jsonb not null default '[]'::jsonb,
  enabled       boolean not null default true,
  dedup_hash    text unique,
  created_at    timestamptz not null default now()
);

-- Cross-check: passage_type must match section.
alter table act.passages add constraint passages_section_type_match check (
  (section = 'english' and passage_type = 'english_essay')
  or (section = 'reading' and passage_type in (
    'literary_narrative', 'social_science', 'humanities', 'natural_science'
  ))
  or (section = 'science' and passage_type in (
    'data_representation', 'research_summaries', 'conflicting_viewpoints'
  ))
);

create index passages_section_type_enabled_idx
  on act.passages (section, passage_type)
  where enabled;

alter table act.passages enable row level security;

-- Select-only RLS for authenticated users — they only see enabled passages.
-- Admins moderate disabled passages via the service-role client (sub-project #6),
-- which bypasses RLS entirely; there is no in-policy admin override (Supabase's
-- `request.jwt.claims.role` is the API role 'anon'/'authenticated', NOT the app
-- role stored in act.profiles.role — so a policy that checked the JWT claim
-- would never match). This mirrors the sat.questions / sat.questions_select_authenticated
-- posture.
create policy "passages_select_authenticated" on act.passages
  for select to authenticated
  using (enabled);

grant select on act.passages to authenticated;

-- dedup_hash auto-fill trigger. n8n inserts omit this column.
create or replace function act.passages_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.dedup_hash is null then
    new.dedup_hash := encode(
      digest(new.section || '|' || new.passage_type || '|' || new.body, 'sha256'),
      'hex'
    );
  end if;
  return new;
end;
$$;

create trigger passages_fill_defaults_trigger
  before insert on act.passages
  for each row execute function act.passages_fill_defaults();
