-- Foundation — act.score_scales.
-- Raw → scaled (1-36) lookup per section. Seeded by a later migration.
-- See spec §3.7.

create table if not exists act.score_scales (
  section       text not null check (section in ('english', 'math', 'reading', 'science')),
  raw_score     int not null check (raw_score >= 0),
  scaled_score  smallint not null check (scaled_score between 1 and 36),
  primary key (section, raw_score)
);

alter table act.score_scales enable row level security;

-- Public to all authenticated users (read-only); the scale itself isn't secret.
create policy "score_scales_select_authenticated" on act.score_scales
  for select to authenticated
  using (true);

grant select on act.score_scales to authenticated;
