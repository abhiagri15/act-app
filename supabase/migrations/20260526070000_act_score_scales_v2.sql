-- act.score_scales v2 — replace linear-interp with a power-function curve
-- that better approximates published ACT scale tables.
--
-- For each section, scaled = round(1 + 35 * (raw/max_raw)^EXPONENT) clamped [1, 36].
-- Exponents: English/Reading 0.65, Math/Science 0.70.
-- These were chosen so raw=50% → scaled ≈ 22-23 (the typical ACT average),
-- which the linear v1 missed (it produced scaled 18 at that point).

truncate act.score_scales;

do $$
declare
  s text;
  max_raw int;
  expnt numeric;
  r int;
  scaled smallint;
begin
  for s, max_raw, expnt in
    select * from (values
      ('english', 50, 0.65),
      ('math',    45, 0.70),
      ('reading', 36, 0.65),
      ('science', 40, 0.70)
    ) as t(s, max_raw, expnt)
  loop
    for r in 0..max_raw loop
      if r = 0 then
        scaled := 1;
      else
        scaled := greatest(
          1::smallint,
          least(36::smallint, round(1 + 35 * power(r::numeric / max_raw, expnt))::smallint)
        );
      end if;
      insert into act.score_scales (section, raw_score, scaled_score)
      values (s, r, scaled);
    end loop;
  end loop;
end $$;
