# ACT App — Sub-project #4 (Persistence + Test Runner) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Ship the full test-taking flow + dashboard + attempt review. Tag the result `post-persistence`.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-persistence-design.md`

**Reference codebase:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\` — particularly `app/components/`, `app/hooks/useTestSession.ts`, and `app/lib/persistence/`.

**Working directory:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

---

## Task 1: RPCs migration (start_section, submit_section, force_lock_section, finalize_attempt, upsert_response, list_my_attempts, get_my_attempt)

**Files:**
- Create: `supabase/migrations/20260526030000_act_attempt_rpcs.sql`

- [ ] **Step 1: Write the migration**

Includes:
- `act.start_section(p_attempt uuid, p_section text)` — `security definer`, sets section_state, current_section, idempotent if not locked
- `act.submit_section(p_attempt uuid, p_section text, p_responses jsonb)` — `security definer`, upserts responses, computes raw + scaled, returns result
- `act.force_lock_section(p_attempt uuid, p_section text)` — `security definer`, idempotent finalize using stored responses only
- `act.finalize_attempt(p_attempt uuid)` — `security definer`, validates all sections done, computes composite
- `act.upsert_response(p_attempt uuid, p_question uuid, p_selected text, p_flagged bool)` — `security definer`, idempotent answer write
- `act.list_my_attempts()` — `security invoker`, returns table of attempts for caller
- `act.get_my_attempt(p_id uuid)` — `security invoker`, returns full attempt detail jsonb

All functions: `set search_path = act, public, pg_temp`. Grant EXECUTE to `authenticated`; revoke from PUBLIC.

Section durations (in seconds): english=2100, math=3000, break=600, reading=2400, science=2400.

- [ ] **Step 2: Apply via Supabase MCP `apply_migration`** with name `act_attempt_rpcs`.

- [ ] **Step 3: Verify all 7 functions exist with correct security setting** via `execute_sql`:
```sql
select p.proname, p.prosecdef as security_definer,
       array_to_string(p.proconfig, ',') as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act' and p.proname in
  ('start_section','submit_section','force_lock_section','finalize_attempt',
   'upsert_response','list_my_attempts','get_my_attempt')
order by p.proname;
```
Expected: 7 rows, 5 are `security_definer=true` (writes), 2 are `false` (reads). All have `search_path` in config.

- [ ] **Step 4: Commit**:
```bash
git add supabase/migrations/20260526030000_act_attempt_rpcs.sql
git commit -m "feat(persistence): attempt RPCs (start/submit/force_lock/finalize/upsert/list/get)"
```

---

## Task 2: Server actions + queries + schemas

**Files:**
- Create: `app/lib/persistence/schema.ts` (zod)
- Create: `app/lib/persistence/actions.ts` (server actions)
- Create: `app/lib/persistence/queries.ts` (read helpers)

- [ ] **Step 1: Write zod schemas** for: `SubmitResponse[]`, `UpsertResponseInput`, `FinalResults`, `AttemptSnapshot`. Mirror SAT's patterns; adjust for ACT data model.

- [ ] **Step 2: Write `actions.ts`** with the 5 server actions (per spec §6).

- [ ] **Step 3: Write `queries.ts`** with `listMyAttempts()` and `getMyAttempt(id)` server helpers.

- [ ] **Step 4:** `pnpm type-check` clean.

- [ ] **Step 5: Commit**:
```bash
git add app/lib/persistence/
git commit -m "feat(persistence): server actions + queries + zod schemas"
```

---

## Task 3: AppHeader + dashboard

**Files:**
- Create: `app/components/AppHeader.tsx`
- Modify: `app/(app)/layout.tsx` (add AppHeader)
- Rewrite: `app/(app)/page.tsx` (dashboard with attempt history)

- [ ] **Step 1: Write `AppHeader.tsx`** — Read SAT's. Server component. Shows "ACT Practice" brand, `/` and `/how-it-works` links, user display name (from `getOrCreateProfile()`), sign-out button (calls the existing `signOut` server action).

- [ ] **Step 2: Update `(app)/layout.tsx`** to render `<AppHeader />` above `{children}`. (Foundation's layout already calls `getOrCreateProfile`.)

- [ ] **Step 3: Rewrite `(app)/page.tsx`** as the dashboard:
- Loads `listMyAttempts()` (server component, no client state)
- Renders "Start a Full Test" card → links to `/test/new`
- Below: list of past attempts (newest first), each showing date + composite + per-section scaled scores + status. Click goes to `/dashboard/attempts/[id]`.
- Empty state when no attempts.

- [ ] **Step 4:** `pnpm type-check && pnpm build`. Both clean.

- [ ] **Step 5: Smoke test** — visit `https://act-app-ten.vercel.app/` while signed in. Should show "Start a Full Test" CTA + empty attempt list.

- [ ] **Step 6: Commit**:
```bash
git add app/components/AppHeader.tsx 'app/(app)/'
git commit -m "feat(persistence): AppHeader + dashboard"
```

---

## Task 4: Pre-test screen

**Files:**
- Create: `app/(app)/test/new/page.tsx`
- Create: `app/(app)/test/new/NewTestForm.tsx`

- [ ] **Step 1: Write `NewTestForm.tsx`** — `'use client'`. A card with:
- "Start a full Enhanced ACT test" heading + subhead with section table (read from `app/lib/act/format.ts` constants)
- Toggle: "Include Science section" (default ON)
- Confirm modal on Start: "You can't pause once started. Section timers are locked. Ready?"
- On confirm: server action calls `supabase.rpc('draw_test', { p_include_science: includeScience })`, then `router.push(`/test/${attemptId}/english`)`.

- [ ] **Step 2: Write `(app)/test/new/page.tsx`** — server component that renders `<NewTestForm />`.

- [ ] **Step 3:** `pnpm type-check && pnpm build`. Clean.

- [ ] **Step 4: Smoke test** — `/test/new` should render the toggle + button.

- [ ] **Step 5: Commit**:
```bash
git add 'app/(app)/test/new/'
git commit -m "feat(persistence): pre-test screen with Science toggle"
```

---

## Task 5: Test runner core (useTestSession + SectionRunner + NumberPalette + SectionHeader)

**Files:**
- Create: `app/hooks/useTestSession.ts`
- Create: `app/components/test/SectionRunner.tsx`
- Create: `app/components/test/NumberPalette.tsx`
- Create: `app/components/test/SectionHeader.tsx`
- Create: `app/components/test/QuestionPane.tsx`
- Create: `app/components/test/ReviewView.tsx`

- [ ] **Step 1: Write `useTestSession.ts`** — per spec §4. Inputs: attemptId, section, questions, passages?, endsAt, initialResponses. Outputs: currentQuestionIdx, responses, remainingSec, setAnswer, toggleFlag, goToQuestion, goToReview, submitNow, isReviewing.

Internals:
- `useState` for responses (array indexed parallel to questions)
- `useState` for currentQuestionIdx
- `useEffect` `setInterval` for 1-sec countdown of `remainingSec`
- `useEffect` fires `submitNow` when `remainingSec === 0`
- `setAnswer` updates local state + fires `upsertResponse` action (debounced 200ms per question)
- `toggleFlag` similar

- [ ] **Step 2: Write `QuestionPane.tsx`** — renders stem + 4 radio choices (A/B/C/D) + flag button.

- [ ] **Step 3: Write `NumberPalette.tsx`** — grid of question cells; color-coded; current question outlined; click to jump.

- [ ] **Step 4: Write `SectionHeader.tsx`** — section name + countdown (red below 5 min) + Review button.

- [ ] **Step 5: Write `ReviewView.tsx`** — list of flagged + unanswered questions; click goes back to that question.

- [ ] **Step 6: Write `SectionRunner.tsx`** — shared orchestrator. Accepts `layout: 'single' | 'two-pane' | 'inline-marker'` and the runtime data; chooses the right rendering pattern (composes the section-specific runner from Task 6).

- [ ] **Step 7:** `pnpm type-check` clean.

- [ ] **Step 8: Commit**:
```bash
git add app/hooks/useTestSession.ts app/components/test/
git commit -m "feat(persistence): test-session hook + shared runner components"
```

---

## Task 6: Section-specific runners (English, Math, Reading, Science)

**Files:**
- Create: `app/components/test/EnglishRunner.tsx`
- Create: `app/components/test/MathRunner.tsx`
- Create: `app/components/test/TwoPaneRunner.tsx`
- Create: `app/components/test/PassagePane.tsx`
- Create: `app/components/test/StimulusRenderer.tsx`

- [ ] **Step 1: `MathRunner.tsx`** (simplest first) — single-pane wrapper around `SectionRunner` with no passage.

- [ ] **Step 2: `PassagePane.tsx`** + `StimulusRenderer.tsx`:
- PassagePane: scrollable container; for English, renders `[[N]]` tokens as highlighted markers
- StimulusRenderer: switch on `stimulus.kind`:
  - `'table'`: `<table>` with caption
  - `'figure'`: simple SVG with axes + series (dependency-free; ~50 lines of SVG line/bar chart logic — mirror SAT's analytics SVG patterns)

- [ ] **Step 3: `TwoPaneRunner.tsx`** — wrapper for Reading + Science. Uses a CSS grid with a resize handle. Persists split ratio in localStorage. Below 768px: stacked with sticky "Show passage" toggle.

- [ ] **Step 4: `EnglishRunner.tsx`** — wrapper for English. Two-pane like Reading but the passage has interactive `[[N]]` markers. Clicking marker N jumps to question N. Current question's marker is highlighted differently (e.g., outline ring).

- [ ] **Step 5:** `pnpm type-check && pnpm build`. Both clean.

- [ ] **Step 6: Commit**:
```bash
git add app/components/test/
git commit -m "feat(persistence): section-specific runners (English inline-marker, Math, Reading/Science two-pane)"
```

---

## Task 7: Section page routes + break + results

**Files:**
- Create: `app/(app)/test/[attemptId]/layout.tsx` (guard: validates attempt is in-progress, redirects to current_section)
- Create: `app/(app)/test/[attemptId]/english/page.tsx`
- Create: `app/(app)/test/[attemptId]/math/page.tsx`
- Create: `app/(app)/test/[attemptId]/break/page.tsx`
- Create: `app/(app)/test/[attemptId]/reading/page.tsx`
- Create: `app/(app)/test/[attemptId]/science/page.tsx`
- Create: `app/(app)/test/[attemptId]/results/page.tsx`
- Create: `app/components/test/BreakScreen.tsx`
- Create: `app/components/test/ResultsScreen.tsx`

- [ ] **Step 1: `[attemptId]/layout.tsx`** — server component:
- Loads `getMyAttempt(attemptId)`
- 404 if not found / not user's
- If `status === 'submitted'`, redirect to `/dashboard/attempts/[id]`
- If `current_section` doesn't match the current route's segment, redirect to `/test/[id]/{current_section}`
- If `section_state[current_section]?.locked === true`, advance to next section
- If `now() > ends_at + 10s`, fire `forceLockSection`, then advance
- Otherwise: render children

- [ ] **Step 2: Section pages** — each is a server component that:
- Calls `startSection(attemptId, section)` (idempotent)
- Reads the attempt snapshot
- Picks out the questions + passages for this section from `draw_test`'s cached payload (stored where? — see below)
- Renders the right runner component

**Where the draw_test payload is stored:**
- `draw_test` is called once from `NewTestForm`. The resulting payload (passages + questions for ALL sections + attempt_id) is returned to the client.
- Client persists the relevant slices (questions, passages, choices) in localStorage scoped to `attemptId`.
- On any section page mount, we read from localStorage. If missing (user cleared cache), re-fetch via a new RPC `act.get_attempt_questions(attemptId)` that returns the same shape minus answer keys. (Add this RPC if needed.)

Alternative: the `act.get_my_attempt(p_id)` RPC returns the full question payload (stems + choices + passages); use that as the source of truth on each section page mount. Saves the localStorage complication. **Use this approach.** It means `get_my_attempt` returns questions WITHOUT answer keys when the attempt is `in_progress` (gate in the RPC).

- [ ] **Step 3: `BreakScreen.tsx`** — 10-min countdown card with "Resume Reading early" button. On click: calls `startSection('reading')` then `router.push('/test/[id]/reading')`. On timer expiry: same auto-advance.

- [ ] **Step 4: `ResultsScreen.tsx`** — renders composite + per-section scaled scores. Links: "Review this test" → `/dashboard/attempts/[id]`; "Return to dashboard" → `/`.

- [ ] **Step 5: `results/page.tsx`** — server component:
- Calls `finalizeAttempt(attemptId)` (idempotent if already finalized)
- Reads final results
- Renders `<ResultsScreen />`

- [ ] **Step 6:** `pnpm type-check && pnpm build`. Clean.

- [ ] **Step 7: Commit**:
```bash
git add 'app/(app)/test/[attemptId]/' app/components/test/BreakScreen.tsx app/components/test/ResultsScreen.tsx
git commit -m "feat(persistence): section page routes + break + results"
```

---

## Task 8: Attempt review page

**Files:**
- Create: `app/(app)/dashboard/attempts/[id]/page.tsx`
- Create: `app/components/review/ReviewItem.tsx`
- Create: `app/components/review/AttemptSummary.tsx`

- [ ] **Step 1: `ReviewItem.tsx`** — server component (no client state needed for v1; #7 will add a Flag button). Renders stem, all 4 choices with the user's selection highlighted + correct answer marked, the explanation, and the question's metadata (section, skill).

- [ ] **Step 2: `AttemptSummary.tsx`** — composite + section scaled + date + status.

- [ ] **Step 3: `attempts/[id]/page.tsx`** — server component:
- Calls `getMyAttempt(id)` → 404 if not found
- Renders `<AttemptSummary />` at top
- Below: ordered list of all questions in the attempt, grouped by section, each as a `<ReviewItem />`. For Reading/Science/English, render the passage above the questions for that passage.

- [ ] **Step 4:** `pnpm type-check && pnpm build`. Clean.

- [ ] **Step 5: Commit**:
```bash
git add 'app/(app)/dashboard/' app/components/review/
git commit -m "feat(persistence): attempt review page"
```

---

## Task 9: End-to-end smoke test + deploy

- [ ] **Step 1: Deploy to Vercel**:
```bash
git push
pnpm dlx vercel --prod --yes 2>&1 | tail -10
```

- [ ] **Step 2: Manual smoke test on production** (if pool is warm enough):
- Sign in
- Click "Start a Full Test"
- Toggle Science off, click Start
- Verify English section loads with 50 questions
- Answer a question, flag another
- Wait OR fast-forward to test timer → wait for auto-submit OR click submit early
- Verify auto-advance to Math
- Etc.

If the pool isn't sufficiently warm yet (warm-pool may still be running), DOCUMENT this as a deferred verification — the code path is type-checked but a full end-to-end test requires the pool.

- [ ] **Step 3: Tag**:
```bash
git tag post-persistence
git push --tags
```

- [ ] **Step 4: Update CLAUDE.md** with the new test-runner architecture + the `useTestSession` hook + the `get_my_attempt` RPC's gate-on-answer-keys behavior.

- [ ] **Step 5: Commit + push**:
```bash
git add CLAUDE.md
git commit -m "docs(persistence): document test runner + useTestSession + answer-key gate"
git push
```

---

## Done When

- [ ] 7 attempt RPCs exist and are security-correct
- [ ] Dashboard at `/` shows attempt history + "Start full test" CTA
- [ ] `/test/new` shows Science toggle + Start
- [ ] 4 section runners render + answer state persists through `upsertResponse`
- [ ] Break screen has 10-min countdown
- [ ] Results screen shows composite + per-section scaled
- [ ] `/dashboard/attempts/[id]` review page renders all questions
- [ ] Resume on reconnect works (refresh mid-section returns to same state)
- [ ] `pnpm type-check`, `pnpm build`, `check-format.ts` all pass
- [ ] Production deploy 200s on `/`, `/test/new`, `/dashboard`
- [ ] Tag `post-persistence` pushed
