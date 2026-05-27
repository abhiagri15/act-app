# ACT App — Sub-project #7 (Feedback) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development.

**Goal:** Ship the user-flag-bad-question flow + admin triage. Tag `post-feedback`.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-feedback-design.md`

**Reference:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\app\components\FlagQuestion.tsx`, `app\(app)\admin\flags\`, `app\components\admin\FlagRow.tsx`, `app\lib\admin\flags.ts`, `app\lib\feedback\actions.ts`.

**Working dir:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

---

## Task 1: submit_flag RPC migration

**Files:** `supabase/migrations/20260526060000_act_submit_flag.sql`

- [ ] **Step 1:** Write migration per spec §2. Security definer, role-checked at SQL layer (reason whitelist), grants EXECUTE to authenticated.

- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` with name `act_submit_flag`.

- [ ] **Step 3:** Verify:
```sql
select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act' and p.proname = 'submit_flag';
```
Expected: 1 row, `prosecdef=true`, `config` contains `search_path=act, public, pg_temp`.

- [ ] **Step 4: Commit**:
```bash
git add supabase/migrations/20260526060000_act_submit_flag.sql
git commit -m "feat(feedback): act.submit_flag RPC"
```

---

## Task 2: submitFlag server action + zod

**Files:**
- Create: `app/lib/feedback/schemas.ts`
- Create: `app/lib/feedback/actions.ts`

- [ ] **Step 1:** `schemas.ts` — zod schema for `{ question_id: uuid, reason: enum(...), notes?: string }`.

- [ ] **Step 2:** `actions.ts` — `'use server'`:
```ts
export async function submitFlag(input: SubmitFlagInput): Promise<{ id: string }> {
  const parsed = submitFlagSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('act')
    .rpc('submit_flag', {
      p_question: parsed.question_id,
      p_reason: parsed.reason,
      p_notes: parsed.notes ?? null,
    });
  if (error) throw error;
  return { id: data as string };
}
```

- [ ] **Step 3:** `pnpm type-check` clean.

- [ ] **Step 4: Commit**:
```bash
git add app/lib/feedback/
git commit -m "feat(feedback): submitFlag server action + zod"
```

---

## Task 3: FlagQuestion widget + ReviewItem integration

**Files:**
- Create: `app/components/FlagQuestion.tsx` (`'use client'`)
- Modify: `app/components/review/ReviewItem.tsx`

- [ ] **Step 1:** `FlagQuestion.tsx` — `'use client'`. Local state: `expanded`, `reason`, `notes`, `submitted`. Submit calls `submitFlag()`. On success: set `submitted=true` and render "Reported. Thanks." with no second submission allowed.

- [ ] **Step 2:** Update `ReviewItem.tsx` — render `<FlagQuestion questionId={q.id} />` below the explanation.

- [ ] **Step 3:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 4: Commit**:
```bash
git add app/components/FlagQuestion.tsx app/components/review/ReviewItem.tsx
git commit -m "feat(feedback): FlagQuestion widget inside ReviewItem"
```

---

## Task 4: Admin flags listing + resolve

**Files:**
- Modify: `app/lib/admin/flags.ts` (was empty stub from #6)
- Create: `app/(app)/admin/flags/page.tsx`
- Create: `app/components/admin/FlagRow.tsx`
- Modify: `app/components/admin/AdminNav.tsx` (add "Open Flags" tab with count badge)
- Modify: `app/(app)/admin/page.tsx` (replace placeholder open-flags card with real count)
- Modify: `app/lib/admin/actions.ts` (add `resolveFlag` server action)

- [ ] **Step 1:** Fill `app/lib/admin/flags.ts`:
```ts
export async function listFlags(status?: 'open'|'resolved'|'dismissed'|'all'): Promise<FlagWithQuestion[]>;
export async function countOpenFlags(): Promise<number>;
```
Both use the admin (service-role) client. `listFlags` joins to `act.questions` + `act.profiles` for user email.

- [ ] **Step 2:** Add `resolveFlag(formData)` to `app/lib/admin/actions.ts`. Calls `requireAdmin()`, then service-role update on `act.question_flags`.

- [ ] **Step 3:** `app/components/admin/FlagRow.tsx` — one flag row with Mark Resolved + Dismiss buttons.

- [ ] **Step 4:** `app/(app)/admin/flags/page.tsx` — filter + list. Filter via `?status=`. Default: open.

- [ ] **Step 5:** Update `AdminNav.tsx` to add the "Open Flags" tab with count badge.

- [ ] **Step 6:** Update `app/(app)/admin/page.tsx` to show real `countOpenFlags()` on the overview card.

- [ ] **Step 7:** `pnpm type-check && pnpm build` clean.

- [ ] **Step 8: Commit**:
```bash
git add app/lib/admin/flags.ts app/lib/admin/actions.ts \
        'app/(app)/admin/flags/' app/components/admin/FlagRow.tsx \
        app/components/admin/AdminNav.tsx 'app/(app)/admin/page.tsx'
git commit -m "feat(feedback): admin flags page + resolve action + nav badge"
```

---

## Task 5: Deploy + smoke + tag

- [ ] **Step 1:** Deploy: `git push && pnpm dlx vercel --prod --yes`.

- [ ] **Step 2: Smoke test** (admin signed in):
  - Visit `/admin/flags` — empty list (no flags yet)
  - Visit `/dashboard/attempts/[id]` for an existing attempt (if any) — FlagQuestion widget visible at bottom of each ReviewItem
  - Submit a test flag → verify it shows up on `/admin/flags?status=open`
  - Mark it resolved → verify it moves to `?status=resolved`
  - Verify AdminNav "Open Flags" badge updates

- [ ] **Step 3:** Update CLAUDE.md.

- [ ] **Step 4: Tag**:
```bash
git add CLAUDE.md
git commit -m "docs(feedback): document flag flow + admin triage"
git push
git tag post-feedback
git push --tags
```

---

## Done When

- [ ] `act.submit_flag` RPC exists with correct security posture
- [ ] FlagQuestion widget renders inside every ReviewItem
- [ ] /admin/flags lists flags with filter + resolve action
- [ ] AdminNav has "Open Flags" tab with count badge
- [ ] Admin overview shows real open-flag count
- [ ] `pnpm type-check`, `pnpm build`, `check-format.ts`, `check-analytics.ts` all pass
- [ ] Production deploy succeeded
- [ ] Tag `post-feedback` pushed
