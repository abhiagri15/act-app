# ACT App — Sub-project #6 (Admin) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development.

**Goal:** Ship the `/admin` area + role-gated moderation + `act.app_config` daily limit. Tag `post-admin`.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-admin-design.md`

**Reference:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\app\(app)\admin\` + `app\lib\admin\` + `app\components\admin\`.

**Working dir:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

---

## Task 1: Admin RPCs + app_config migration

**Files:** `supabase/migrations/20260526050000_act_admin_rpcs.sql`

- [ ] **Step 1:** Write the migration. Includes:
  - `act.app_config` table (single row, daily_attempt_limit)
  - `act.admin_users_summary()` RPC (security definer, role-checked)
  - `act.admin_user_analytics(p_user)` RPC (security definer, role-checked) — full body mirrors `act.user_analytics()` but filters by `p_user`
  - Amend `act.draw_test`: enforce daily_attempt_limit

- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` with name `act_admin_rpcs`.

- [ ] **Step 3: Verify**:
```sql
select p.proname, p.prosecdef as security_definer,
       array_to_string(p.proconfig, ',') as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act' and p.proname in
  ('admin_users_summary','admin_user_analytics','draw_test')
order by p.proname;

select * from act.app_config;
```
Expected: 3 functions; app_config row 1 with `daily_attempt_limit=5`.

- [ ] **Step 4: Test daily cap** — promote yourself to admin (via SQL as service_role), then call `act.draw_test(false)` 5 times in quick succession. The 6th should raise. (Skip the actual test if pool is too thin — verify just by reading the function body.)

- [ ] **Step 5: Commit**:
```bash
git add supabase/migrations/20260526050000_act_admin_rpcs.sql
git commit -m "feat(admin): app_config + admin RPCs + daily_attempt_limit enforcement"
```

---

## Task 2: requireAdmin helper + admin queries

**Files:**
- Create: `app/lib/admin/guard.ts`
- Create: `app/lib/admin/queries.ts`
- Create: `app/lib/admin/users.ts`
- Create: `app/lib/admin/actions.ts`
- Create: `app/lib/admin/flags.ts` (empty stub for #7)
- Create: `app/lib/config.ts`

- [ ] **Step 1: `guard.ts`** — `requireAdmin()` reads profile, `notFound()` if not admin.

- [ ] **Step 2: `queries.ts`** — `listQuestions(filters)`, `getQuestion(id)`, `listPassages(filters)`, `getPassage(id)`, `getPoolCounts()`, `listGenerationRuns(limit)`. Use the admin client (service-role) for these.

- [ ] **Step 3: `users.ts`** — `listUsersWithStats()`, `getUserProfileForAdmin(id)`, `getUserAnalyticsForAdmin(id)`. Internally call the admin_* RPCs.

- [ ] **Step 4: `actions.ts`** — `'use server'`. `setQuestionEnabled(formData)`, `setPassageEnabled(formData)`, `setDailyAttemptLimit(formData)`. Each calls `requireAdmin()` then uses service-role client; revalidates paths.

- [ ] **Step 5: `flags.ts`** — empty file with comment `// Fills in sub-project #7`.

- [ ] **Step 6: `config.ts`** — `getDailyLimit()` returns the int from `act.app_config`; used by the public-side test-start gate.

- [ ] **Step 7:** `pnpm type-check` clean.

- [ ] **Step 8: Commit**:
```bash
git add app/lib/admin/ app/lib/config.ts
git commit -m "feat(admin): requireAdmin guard + admin queries/users/actions"
```

---

## Task 3: AdminNav + layout

**Files:**
- Create: `app/components/admin/AdminNav.tsx` (`'use client'`)
- Create: `app/(app)/admin/layout.tsx`
- Modify: `app/components/AppHeader.tsx` (add `/admin` link for admins only)

- [ ] **Step 1: `AdminNav.tsx`** — Tab-style nav with 6 items: Overview, Question Pool, Passages, Users, Generation, Settings. Active tab via `usePathname()`. (Open Flags will be added in #7.)

- [ ] **Step 2: `admin/layout.tsx`** — server component. `await requireAdmin()` first; then `<AdminNav />` + `{children}`.

- [ ] **Step 3: `AppHeader.tsx`** — read `getOrCreateProfile()`; if `role === 'admin'`, render `/admin` link between `/analytics` and `/how-it-works`.

- [ ] **Step 4:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 5: Commit**:
```bash
git add app/components/admin/AdminNav.tsx 'app/(app)/admin/layout.tsx' app/components/AppHeader.tsx
git commit -m "feat(admin): /admin layout with requireAdmin gate + sub-nav"
```

---

## Task 4: Overview, Questions, Passages

**Files:**
- Create: `app/(app)/admin/page.tsx` (overview)
- Create: `app/(app)/admin/questions/page.tsx`
- Create: `app/(app)/admin/questions/[id]/page.tsx`
- Create: `app/(app)/admin/passages/page.tsx`
- Create: `app/(app)/admin/passages/[id]/page.tsx`
- Create: `app/components/admin/QuestionRow.tsx`
- Create: `app/components/admin/PassageRow.tsx`

- [ ] **Step 1: Overview** — 4 stat cards: pool counts (per section), user count, open flags (link to /admin/flags — page added in #7), daily attempt limit. Each card has a link to the detail page.

- [ ] **Step 2: Questions list** — `?section=...&skill=...&status=enabled|disabled|all`. Table of QuestionRow.

- [ ] **Step 3: Question detail** — full stem + choices (correct marked) + explanation + metadata + enable/disable toggle form bound to `setQuestionEnabled`. Link back to list.

- [ ] **Step 4: Passages list + detail** — same shape as questions. Passage detail shows body + stimuli rendered + list of its children questions (which inherit the disable cascade).

- [ ] **Step 5:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 6: Commit**:
```bash
git add 'app/(app)/admin/' app/components/admin/
git commit -m "feat(admin): overview + questions pool + passages pool"
```

---

## Task 5: Users, Generation log, Settings

**Files:**
- Create: `app/(app)/admin/users/page.tsx`
- Create: `app/(app)/admin/users/[id]/page.tsx`
- Create: `app/(app)/admin/generation/page.tsx`
- Create: `app/(app)/admin/settings/page.tsx`
- Create: `app/components/admin/UserRow.tsx`
- Create: `app/components/admin/GenerationRunRow.tsx`

- [ ] **Step 1: Users list** — `listUsersWithStats()` → `<UserRow />` per row. Click → `/admin/users/[id]`.

- [ ] **Step 2: User detail** — same shape as `/analytics` for the selected user. Reuses `SummaryStats`, `ScoreTrend`, `SectionTrend`, `SectionAccuracy`, `SkillAccuracy`, `FocusAreas`. Use `getUserAnalyticsForAdmin(id)`.

- [ ] **Step 3: Generation log** — last 50 `act.generation_runs` rows. Each shows: started_at, skill/passage_type, target, produced, errors count (with hover for detail).

- [ ] **Step 4: Settings** — form for `daily_attempt_limit`. Submit calls `setDailyAttemptLimit`.

- [ ] **Step 5:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 6: Commit**:
```bash
git add 'app/(app)/admin/' app/components/admin/
git commit -m "feat(admin): users + generation log + settings"
```

---

## Task 6: Promote admin + smoke test + tag

- [ ] **Step 1: Promote yourself to admin** via service-role SQL:
```sql
update act.profiles set role = 'admin' where email = 'abhishek15@gmail.com';
```
(Use Supabase MCP `execute_sql`.)

- [ ] **Step 2:** Deploy: `git push && pnpm dlx vercel --prod --yes`.

- [ ] **Step 3: Smoke test** — visit production `/admin`, verify 200. Visit `/admin/questions`, verify list renders. Toggle a question disabled → verify it disappears from the list with `?status=enabled` filter.

- [ ] **Step 4: Update CLAUDE.md** — document `/admin` area, `requireAdmin()` pattern, role-promotion SQL, daily-limit setting location.

- [ ] **Step 5: Tag**:
```bash
git add CLAUDE.md
git commit -m "docs(admin): document /admin area + requireAdmin + role promotion"
git push
git tag post-admin
git push --tags
```

---

## Done When

- [ ] `act.app_config` table + 2 admin RPCs exist with correct security posture
- [ ] `act.draw_test` enforces daily cap
- [ ] `/admin` returns 404 for non-admins, 200 for admins
- [ ] All 8 admin pages render with correct data
- [ ] `setQuestionEnabled` and `setPassageEnabled` work via the service-role path
- [ ] Disabling a passage cascade-hides its children questions from new draws
- [ ] AppHeader shows `/admin` link only for admins
- [ ] `pnpm type-check`, `pnpm build`, `check-format.ts`, `check-analytics.ts` all pass
- [ ] Production deploy succeeded
- [ ] Tag `post-admin` pushed
