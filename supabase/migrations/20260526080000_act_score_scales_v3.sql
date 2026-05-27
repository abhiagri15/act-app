-- act.score_scales v3 — replace v2 power-function with the rescaled
-- Classic ACT scale (source: ACT's "Preparing for the ACT 2021-2022" booklet).
-- Per-form variation is ±1-2 points; this scale is representative.
--
-- Mapping: classic_equivalent_raw = round(enhanced_raw * classic_max / enhanced_max).
-- Science (40 = 40) requires no rescaling; uses Classic Science directly.

truncate act.score_scales;

do $$
declare
  -- Classic ACT scale arrays. Index = classic_raw, value = scaled. Length = max+1.
  english_classic smallint[] := array[
    1,2,3,4,5,5,6,6,6,7,7,7,8,8,8,9,9,9,9,10,10,10,10,11,11,11,
    12,12,12,12,13,13,13,14,14,14,15,15,15,16,16,17,17,18,18,19,19,
    20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,30,30,
    31,32,33,34,34,35,35,36
  ]; -- length 76 (indices 0..75)
  math_classic smallint[] := array[
    1,4,6,8,9,10,11,11,12,12,13,13,14,14,14,15,15,15,16,16,16,
    17,17,17,18,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,
    26,26,27,27,28,28,28,29,29,30,30,31,31,32,32,33,34,34,35,36
  ]; -- length 61 (indices 0..60)
  reading_classic smallint[] := array[
    1,3,5,7,8,9,10,11,11,12,12,13,13,14,15,15,16,17,18,19,20,
    21,21,22,23,23,24,25,25,26,27,28,29,30,31,32,32,33,34,35,36
  ]; -- length 41 (indices 0..40)
  science_classic smallint[] := array[
    1,2,4,6,8,9,10,11,12,13,14,15,16,17,17,18,19,20,21,22,22,
    23,23,24,25,25,26,26,27,27,28,28,29,30,31,32,33,33,34,35,36
  ]; -- length 41 (indices 0..40)
  r int;
  classic_r int;
  scaled smallint;
begin
  -- English (Enhanced 0..50 → Classic 75)
  for r in 0..50 loop
    classic_r := round(r::numeric * 75 / 50)::int;
    if classic_r > 75 then classic_r := 75; end if;
    scaled := english_classic[classic_r + 1];
    insert into act.score_scales (section, raw_score, scaled_score)
    values ('english', r, scaled);
  end loop;

  -- Math (Enhanced 0..45 → Classic 60)
  for r in 0..45 loop
    classic_r := round(r::numeric * 60 / 45)::int;
    if classic_r > 60 then classic_r := 60; end if;
    scaled := math_classic[classic_r + 1];
    insert into act.score_scales (section, raw_score, scaled_score)
    values ('math', r, scaled);
  end loop;

  -- Reading (Enhanced 0..36 → Classic 40)
  for r in 0..36 loop
    classic_r := round(r::numeric * 40 / 36)::int;
    if classic_r > 40 then classic_r := 40; end if;
    scaled := reading_classic[classic_r + 1];
    insert into act.score_scales (section, raw_score, scaled_score)
    values ('reading', r, scaled);
  end loop;

  -- Science (Enhanced 0..40 → Classic 40, no rescaling)
  for r in 0..40 loop
    scaled := science_classic[r + 1];
    insert into act.score_scales (section, raw_score, scaled_score)
    values ('science', r, scaled);
  end loop;
end $$;
