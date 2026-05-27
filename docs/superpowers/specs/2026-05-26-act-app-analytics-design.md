# ACT App — Sub-project #5 (Analytics) Design

> Narrower spec built against the overview design. Sub-project #5 delivers `/analytics` showing trends, per-section and per-skill accuracy, focus areas, and summary stats.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-analytics`

---

## 1. Scope

After this lands, `/analytics` shows:
- Summary stats (tests taken, average composite, best composite, latest composite)
- Composite-trend line chart (last N attempts)
- Per-section scaled-score trend (4 lines, one per section)
- Per-section accuracy (% correct, last 5 attempts)
- Per-skill accuracy bars (grouped by section, weakest first, color-graded)
- Focus areas callout (3 weakest skills with concrete examples of missed questions)
- Empty state if `testsTaken === 0`

**In scope:**
- 1 RPC: `act.user_analytics()` — `security invoker`, aggregates the caller's attempts + responses
- `/analytics` page (server component)
- Components: `ScoreTrend`, `SectionTrend`, `SkillAccuracy`, `FocusAreas`, `SummaryStats`
- Pure compute helpers: `accuracyPct`, `sortSkillsWeakestFirst`, `focusAreas`, `summarize`
- Dependency-free SVG/CSS visuals (mirror SAT)

**Out of scope:**
- Per-passage analytics (deferred)
- Comparison to other users (deferred)
- PDF export (deferred)

---

## 2. RPC

```sql
create or replace function act.user_analytics()
returns jsonb
language plpgsql
security invoker
set search_path = act, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then return null; end if;

  with attempts as (
    select id, started_at, submitted_at, status, composite,
           scaled_scores, include_science
    from act.test_attempts
    where user_id = v_user and status = 'submitted'
    order by submitted_at desc
  ),
  responses as (
    select ar.section, q.skill, ar.is_correct
    from act.attempt_responses ar
    join act.questions q on q.id = ar.question_id
    join act.test_attempts a on a.id = ar.attempt_id
    where a.user_id = v_user and a.status = 'submitted'
  ),
  by_skill as (
    select section, skill,
           count(*) filter (where is_correct) as correct,
           count(*) as total
    from responses
    group by section, skill
  ),
  by_section as (
    select section,
           count(*) filter (where is_correct) as correct,
           count(*) as total
    from responses
    group by section
  )
  select jsonb_build_object(
    'tests_taken', (select count(*) from attempts),
    'latest_composite', (select composite from attempts limit 1),
    'avg_composite', (select round(avg(composite)::numeric, 1) from attempts),
    'best_composite', (select max(composite) from attempts),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
        'attempt_id', id, 'submitted_at', submitted_at,
        'composite', composite, 'scaled_scores', scaled_scores,
        'include_science', include_science
      ) order by submitted_at desc) from attempts), '[]'::jsonb),
    'sections', coalesce((select jsonb_object_agg(
      section, jsonb_build_object('correct', correct, 'total', total)
    ) from by_section), '{}'::jsonb),
    'skills', coalesce((select jsonb_agg(jsonb_build_object(
      'section', section, 'skill', skill,
      'correct', correct, 'total', total
    )) from by_skill), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function act.user_analytics() from public;
grant execute on function act.user_analytics() to authenticated;
```

---

## 3. File Structure

```
app/(app)/analytics/page.tsx                  server component
app/lib/analytics/compute.ts                  pure helpers + types
app/lib/analytics/queries.ts                  getAnalytics() — calls RPC
app/components/analytics/SummaryStats.tsx     4 stat cards
app/components/analytics/ScoreTrend.tsx       inline SVG line chart of composite
app/components/analytics/SectionTrend.tsx     4-line SVG chart of scaled scores
app/components/analytics/SectionAccuracy.tsx  per-section % correct bars
app/components/analytics/SkillAccuracy.tsx    per-skill bars grouped by section
app/components/analytics/FocusAreas.tsx       3 weakest skills + sample missed questions
app/components/AppHeader.tsx                  MODIFIED: add /analytics nav link
supabase/migrations/20260526040000_act_user_analytics.sql
```

---

## 4. Compute helpers (pure, scripted-test-friendly)

```ts
// app/lib/analytics/compute.ts
export interface SkillStat { section: ActSection; skill: string; correct: number; total: number; }
export interface SectionStat { section: ActSection; correct: number; total: number; }
export interface TrendPoint { attempt_id: string; submitted_at: string; composite: number; scaled_scores: Record<ActSection, number>; include_science: boolean; }
export interface AnalyticsView { tests_taken: number; latest_composite: number | null; avg_composite: number | null; best_composite: number | null; trend: TrendPoint[]; sections: SectionStat[]; skills: SkillStat[]; }

export function accuracyPct(correct: number, total: number): number;     // round to 1 decimal
export function sortSkillsWeakestFirst(skills: SkillStat[]): SkillStat[]; // by accuracy ascending
export function focusAreas(skills: SkillStat[], maxCount: number = 3): SkillStat[]; // weakest-first, only those with ≥ 5 attempts
export function summarize(view: AnalyticsView): { testsTaken: number; latest: number | null; avg: number | null; best: number | null };
```

---

## 5. Visuals

All dependency-free SVG/CSS. Patterns from SAT:

- **ScoreTrend / SectionTrend**: SVG `<polyline>` per series. X axis = attempt index, Y axis = 1-36. Annotated dots at each attempt with hover tooltips. Sections in different colors.
- **SectionAccuracy / SkillAccuracy**: horizontal `<div>` bars with width = `${accuracyPct}%`, color graded green→yellow→red.
- **FocusAreas**: card with the 3 weakest skills, each showing "Skill name (XX% over N attempts) — work on: <missed-question-stem-preview>".

---

## 6. Sub-project boundaries

**What #6 (Admin) gets from #5:**
- The compute helpers can be reused for admin per-user analytics drill-throughs.

**What this does NOT do:**
- Per-user analytics for admins (lifted in #6 by reusing the same helpers + a sibling `act.admin_user_analytics(p_user)` RPC).
- Per-passage drill-through (deferred).

---

## 7. References

- Overview spec §7 #5
- SAT precedent: `Personal/satpracticereact/sat-app/app/lib/analytics/`, `app/components/analytics/`, `app/(app)/analytics/page.tsx`
