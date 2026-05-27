# ACT App — Sub-project #5 (Analytics) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development.

**Goal:** Ship `/analytics` with composite-trend, per-section trend, per-section accuracy, per-skill accuracy, focus areas, and summary stats. Tag `post-analytics`.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-analytics-design.md`

**Reference:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\app\lib\analytics\` and `app\components\analytics\`.

**Working directory:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

---

## Task 1: user_analytics RPC migration

**Files:** `supabase/migrations/20260526040000_act_user_analytics.sql`

- [ ] **Step 1:** Write the migration per spec §2. The RPC is `security invoker` (RLS scopes results to caller), has locked `search_path`, returns the analytics view as jsonb.

- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` with name `act_user_analytics`.

- [ ] **Step 3:** Verify via `execute_sql`:
```sql
select p.proname, p.prosecdef as security_definer,
       array_to_string(p.proconfig, ',') as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act' and p.proname = 'user_analytics';
```
Expected: 1 row, `security_definer=false`, `search_path=act, public, pg_temp`.

- [ ] **Step 4: Commit**:
```bash
git add supabase/migrations/20260526040000_act_user_analytics.sql
git commit -m "feat(analytics): act.user_analytics() RPC"
```

---

## Task 2: Compute helpers + queries

**Files:**
- Create: `app/lib/analytics/compute.ts`
- Create: `app/lib/analytics/queries.ts`
- Create: `scripts/check-analytics.ts`

- [ ] **Step 1: `compute.ts`** per spec §4. Types + 4 pure functions.

- [ ] **Step 2: `queries.ts`** — `getAnalytics()` server helper:
```ts
export async function getAnalytics(): Promise<AnalyticsView> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('user_analytics');
  if (error) throw error;
  return data as AnalyticsView;
}
```

- [ ] **Step 3: `check-analytics.ts`** — scripted assertions for the 4 compute helpers (mirror SAT's `check-analytics.ts`).

- [ ] **Step 4:** `pnpm dlx tsx scripts/check-analytics.ts` passes.

- [ ] **Step 5: Commit**:
```bash
git add app/lib/analytics/ scripts/check-analytics.ts
git commit -m "feat(analytics): compute helpers + getAnalytics() + scripted check"
```

---

## Task 3: Visual components

**Files:**
- Create: `app/components/analytics/SummaryStats.tsx`
- Create: `app/components/analytics/ScoreTrend.tsx`
- Create: `app/components/analytics/SectionTrend.tsx`
- Create: `app/components/analytics/SectionAccuracy.tsx`
- Create: `app/components/analytics/SkillAccuracy.tsx`
- Create: `app/components/analytics/FocusAreas.tsx`

All server components (no client state needed; props in, SVG/CSS out). Read SAT's components for the SVG-line-chart and CSS-bar patterns.

- [ ] **Step 1:** `SummaryStats.tsx` — 4 cards (tests taken, avg, best, latest composite). Empty state.

- [ ] **Step 2:** `ScoreTrend.tsx` — single-series SVG polyline of composite over attempts. X axis = attempt index (1..N), Y axis = 1-36.

- [ ] **Step 3:** `SectionTrend.tsx` — 4 polylines (English/Math/Reading/Science), color-coded. Skip Science line for attempts where `include_science === false`.

- [ ] **Step 4:** `SectionAccuracy.tsx` — 4 horizontal bars with % labels.

- [ ] **Step 5:** `SkillAccuracy.tsx` — group by section, weakest-first within section, color graded.

- [ ] **Step 6:** `FocusAreas.tsx` — accept the analytics view, compute `focusAreas(skills, 3)`, render a card with each.

- [ ] **Step 7:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 8: Commit**:
```bash
git add app/components/analytics/
git commit -m "feat(analytics): SVG/CSS dependency-free visual components"
```

---

## Task 4: /analytics page + AppHeader link

**Files:**
- Create: `app/(app)/analytics/page.tsx`
- Modify: `app/components/AppHeader.tsx` (add /analytics nav link)

- [ ] **Step 1: `analytics/page.tsx`** — server component. Calls `getAnalytics()`. Renders summary + trends + section accuracy + skill accuracy + focus areas. Shows empty state when `tests_taken === 0`.

- [ ] **Step 2:** Modify `AppHeader.tsx` — add `/analytics` link between `/` and `/how-it-works`.

- [ ] **Step 3:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 4: Smoke test** — visit `https://act-app-ten.vercel.app/analytics` (signed in). With 0 attempts, shows empty state.

- [ ] **Step 5: Commit**:
```bash
git add 'app/(app)/analytics/' app/components/AppHeader.tsx
git commit -m "feat(analytics): /analytics page + AppHeader nav link"
```

---

## Task 5: Deploy + tag

- [ ] **Step 1:** Push + deploy:
```bash
git push
pnpm dlx vercel --prod --yes 2>&1 | tail -5
```

- [ ] **Step 2:** Update CLAUDE.md — document the `/analytics` page + the `user_analytics` RPC's security-invoker pattern.

- [ ] **Step 3:** Tag + push:
```bash
git add CLAUDE.md
git commit -m "docs(analytics): document /analytics + user_analytics RPC posture"
git push
git tag post-analytics
git push --tags
```

---

## Done When

- [ ] `act.user_analytics()` exists, `security_invoker`, locked `search_path`
- [ ] `/analytics` page renders empty state with 0 attempts; renders charts with ≥1 attempt
- [ ] AppHeader has the new nav link
- [ ] `pnpm type-check`, `pnpm build`, `check-format.ts`, `check-analytics.ts` all pass
- [ ] Production deploy succeeded
- [ ] Tag `post-analytics` pushed
