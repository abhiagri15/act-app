-- Move floor values from hardcoded constants in app/lib/ai/generate.ts to
-- runtime-tunable config. Defaults match the current hardcoded values so
-- behavior is unchanged on apply.

alter table act.app_config
  add column if not exists min_skill_floor smallint not null default 3
    check (min_skill_floor between 0 and 50),
  add column if not exists min_passage_floor smallint not null default 1
    check (min_passage_floor between 0 and 20);
