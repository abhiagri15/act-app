-- Foundation — seed act.score_scales with an Enhanced-ACT-shaped mapping.
-- For each section, raw 0..N (N = section question count) → scaled 1..36
-- via smooth linear interpolation across the raw range. Replace with a
-- specific published form later if calibration matters.

-- Helper: insert a section's mapping by interpolating between (0, 1) and (max_raw, 36).
do $$
declare
  s text;
  max_raw int;
  r int;
  scaled smallint;
begin
  for s, max_raw in
    select * from (values
      ('english', 50),
      ('math', 45),
      ('reading', 36),
      ('science', 40)
    ) as t(s, max_raw)
  loop
    for r in 0..max_raw loop
      -- Linear interpolation: raw 0 -> scaled 1, raw max -> scaled 36.
      -- round to nearest integer; clamp to [1, 36].
      scaled := greatest(
        1,
        least(36, round(1 + (35.0 * r / max_raw)))::smallint
      );
      insert into act.score_scales (section, raw_score, scaled_score)
      values (s, r, scaled)
      on conflict (section, raw_score) do nothing;
    end loop;
  end loop;
end $$;
