# ACT App — Sub-project #4 (Persistence + Test Runner) Design

> Narrower spec built against the overview design at `2026-05-26-act-app-overview-design.md`. Sub-project #4 delivers the test-taking flow end-to-end: pre-test screen → 4 section runners → break → results, plus the dashboard / attempt review pages.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-persistence`

---

## 1. Scope & Goals

After this sub-project lands:
1. A signed-in user lands on `/` and sees a dashboard with "Start a Full Test" CTA + their attempt history.
2. Clicking the CTA goes to `/test/new` — a pre-test screen with an "Include Science section" toggle and a confirm modal.
3. The full Enhanced ACT runs: English → Math → 10-min break → Reading → [Science if included] → Results.
4. Each section has a section-locked timer; auto-submit fires when the timer hits 0.
5. Reading and Science use a resizable two-pane layout (passage left, question right); English uses an inline-marker layout (passage with `[[N]]` highlights); Math is single-pane.
6. Number palette across the bottom shows answered / flagged / unanswered.
7. Results screen shows composite (1-36) + per-section scaled scores.
8. Past attempts are listed at `/dashboard`; clicking one shows the per-question review at `/dashboard/attempts/[id]`.
9. Refreshing mid-test resumes the session correctly.

**In scope:**
- 4 new RPCs: `act.start_section`, `act.submit_section`, `act.force_lock_section`, `act.finalize_attempt`
- 2 new read RPCs: `act.list_my_attempts()`, `act.get_my_attempt(id)`
- `<AppHeader/>` component (reads cached profile, shows sign-out)
- `(app)/page.tsx` becomes the dashboard
- `(app)/test/new/page.tsx` — pre-test screen
- `(app)/test/[attemptId]/{english,math,break,reading,science,results}/page.tsx` — 6 section/result pages
- `(app)/dashboard/attempts/[id]/page.tsx` — attempt review
- `useTestSession` hook for client-side timer + answer state
- Two-pane resizable passage component
- Number palette + flag button + review-view-last-5-min
- Score scaling via `act.score_scales` lookup
- Optimistic answer writes (via `act.upsert_response` RPC)

**Explicitly deferred:**
- Admin moderation UI (#6)
- Per-question flag-bad-question UI (#7)
- Analytics page (#5)

### Success bar

1. User picks "Include Science" then "Start" → 50 English questions render in a single-pane runner with a 35-min timer.
2. User answers a question → checkmark appears in palette; clicks "Flag" → flag indicator appears; clicks back to a flagged question → answer is preserved.
3. Timer hits 0 → section auto-submits → user is forced to next section (math).
4. After math → break screen with 10-min countdown + "Resume Reading early" button.
5. After science (or reading if science skipped) → results show composite 1-36 + per-section scaled scores + question-by-question review.
6. Refreshing during a section → comes back to the same question, same timer, same answers.

---

## 2. RPCs (4 + 3 helpers)

### `act.start_section(p_attempt uuid, p_section text) returns void`

- Validates section sequence: english → math → break → reading → science (skips science if `include_science=false`).
- Sets `section_state[p_section] = { started_at: now(), ends_at: now() + duration, submitted_at: null, locked: false }`.
- Updates `test_attempts.current_section = p_section`.
- Idempotent: if section already started AND not yet locked, returns without changing state.
- Raises if attempt is `submitted` or `abandoned`.

Section durations (in seconds): english=2100, math=3000, break=600, reading=2400, science=2400.

### `act.submit_section(p_attempt uuid, p_section text, p_responses jsonb) returns jsonb`

- `p_responses` shape: `[{ question_id, selected: 'A'|'B'|'C'|'D'|null, flagged: boolean }, ...]`
- Validates: caller owns the attempt; section is `current_section`; not already locked.
- Server clock check: if `now() > ends_at + 10s grace`, the submission is rejected with `'section deadline missed; call force_lock_section'`.
- Upserts all responses into `act.attempt_responses` (PK is `(attempt_id, question_id)`).
- Sets `is_correct` by joining to `act.questions.answer_key`.
- Sets `section_state[p_section].submitted_at = now(), locked = true`.
- Computes section raw (correct count) + scaled (lookup in `act.score_scales`).
- Stores in `raw_scores[p_section]` and `scaled_scores[p_section]`.
- Returns `{ raw_score, scaled_score, section, locked: true }`.

### `act.force_lock_section(p_attempt uuid, p_section text) returns jsonb`

- Same as `submit_section` but uses whatever responses are ALREADY in `act.attempt_responses` (no new payload).
- Idempotent: if already locked, returns the existing stored scores.
- Called by the client on resume when `now() > ends_at`.

### `act.finalize_attempt(p_attempt uuid) returns jsonb`

- Validates: all sections completed (english + math + reading must be locked; science conditionally).
- Computes composite per spec §4.7: `round(mean(included scaled scores)::numeric)`.
- Sets `submitted_at = now()`, `status = 'submitted'`, `composite`.
- Returns full results bundle: `{ attempt_id, composite, scaled_scores, raw_scores, started_at, submitted_at, include_science }`.

### `act.upsert_response(p_attempt uuid, p_question uuid, p_selected text, p_flagged bool) returns void`

- Helper for live answer writes. Caller is the test runner UI on each answer selection or flag toggle.
- Validates: caller owns the attempt; question is part of the current section's draw; section is not yet locked.
- `is_correct` is NULL until `submit_section` runs (we never expose live feedback during a section).
- Used to enable refresh-resumption: every answer is persisted server-side.

### `act.list_my_attempts() returns table(...)`

- Returns `id, started_at, submitted_at, status, include_science, composite` for the caller, newest first.
- `security invoker` — RLS handles user scoping.

### `act.get_my_attempt(p_id uuid) returns jsonb`

- Returns the full attempt detail: per-section breakdown, all questions with their stems + choices + correct answer + user's selection + flagged + is_correct + passage (if applicable).
- Used by the review page.
- `security invoker` — RLS denies if not the caller's attempt.

---

## 3. File Structure

```
app/
├── (app)/
│   ├── layout.tsx                       MODIFIED: adds <AppHeader/>
│   ├── page.tsx                         REWRITTEN: dashboard ("Start full test" + attempt list)
│   ├── test/
│   │   ├── new/
│   │   │   ├── page.tsx                 pre-test (Science toggle + Start)
│   │   │   └── NewTestForm.tsx          'use client'
│   │   ├── [attemptId]/
│   │   │   ├── layout.tsx               loads attempt state; guards section sequence
│   │   │   ├── english/page.tsx         section runner — English (inline-marker)
│   │   │   ├── math/page.tsx            section runner — Math (single-pane)
│   │   │   ├── break/page.tsx           10-min break + "Resume Reading early"
│   │   │   ├── reading/page.tsx         section runner — Reading (two-pane)
│   │   │   ├── science/page.tsx         section runner — Science (two-pane)
│   │   │   └── results/page.tsx         finalize + display composite + per-section
│   └── dashboard/
│       └── attempts/
│           └── [id]/page.tsx            attempt review
├── components/
│   ├── AppHeader.tsx                    NEW
│   ├── test/
│   │   ├── SectionRunner.tsx            shared client-side controller
│   │   ├── EnglishRunner.tsx            inline-marker layout
│   │   ├── MathRunner.tsx               single-pane
│   │   ├── TwoPaneRunner.tsx            reading/science wrapper
│   │   ├── PassagePane.tsx              passage with optional stimuli rendering
│   │   ├── QuestionPane.tsx             stem + 4 choices + flag button
│   │   ├── NumberPalette.tsx            grid of question buttons (answered/flagged/unanswered)
│   │   ├── SectionHeader.tsx            timer + Review button (last 5 min)
│   │   ├── ReviewView.tsx               filtered list of flagged + unanswered
│   │   ├── BreakScreen.tsx              countdown + Resume button
│   │   ├── ResultsScreen.tsx            composite + scaled + per-section
│   │   └── StimulusRenderer.tsx         renders table / figure data from passages.stimuli jsonb
│   └── review/
│       ├── ReviewItem.tsx               per-question review block (stem, choices marked, expl)
│       └── AttemptSummary.tsx           composite + section scaled + date
├── hooks/
│   └── useTestSession.ts                in-section client state (timer + answers + flags)
└── lib/
    ├── persistence/
    │   ├── actions.ts                   server actions: startSection, submitSection, forceLockSection, finalizeAttempt, upsertResponse
    │   ├── queries.ts                   listMyAttempts, getMyAttempt
    │   └── schema.ts                    zod schemas for payloads
    └── act/
        └── format.ts                    UNCHANGED — already has durations
```

---

## 4. Test-Session State Machine (Client-Side)

The test runner is a single client-side controller (`useTestSession` hook) that:

1. Reads the attempt's `current_section` + `section_state[current_section]` on mount.
2. Computes `remainingMs = section_state.ends_at - Date.now()`.
3. Renders the section's questions.
4. On answer selection: optimistic local update + fire-and-forget `upsertResponse` server action.
5. On flag toggle: same pattern.
6. Drives a `setInterval` 1s countdown.
7. When `remainingMs <= 0` AND not yet submitted: fires `submitSection` (auto-submit). If that fails (e.g., 11s past deadline), fires `forceLockSection`.
8. On manual submit (user clicks "Submit section"): fires `submitSection` with the local response state.
9. After successful submit: client navigates to the next section's route.

The hook accepts:
- `attemptId: string`
- `section: ActSection`
- `questions: Question[]` (from `act.draw_test` payload, cached in TanStack Query)
- `passages: Passage[]` (for Reading/Science only)
- `endsAt: string` (ISO timestamp from `section_state`)
- `initialResponses: { question_id, selected, flagged }[]` (from `act.attempt_responses` for resume)

The hook returns:
- `currentQuestionIdx: number`
- `responses: { selected: 'A'|'B'|'C'|'D'|null, flagged: boolean }[]` (indexed parallel to questions)
- `remainingSec: number`
- `setAnswer(idx, choice)`, `toggleFlag(idx)`, `goToQuestion(idx)`, `goToReview()`, `submitNow()`
- `isReviewing: boolean` (true when palette open or last 5 min)

---

## 5. Layouts

### 5.1 English (inline-marker)

A two-column layout: passage on left (60% width), question pane on right (40%). The passage body is rendered with `[[N]]` tokens replaced by `<span data-marker="N" className="bg-yellow-100 px-1 rounded">{N}</span>`. Clicking marker `N` (or pressing `→`/`←`) jumps to the corresponding question. The question pane shows the current question's stem + 4 choices (A/B/C/D radio group).

Number palette at the bottom shows 50 cells (one per question). Each cell shows the question number, color-coded:
- Empty: gray border
- Answered: filled with primary color
- Flagged: small flag indicator in corner
- Current: ring outline

### 5.2 Math (single-pane)

A single centered column (max-w-2xl). Stem + 4 choices. No passage. Number palette at bottom (45 cells).

### 5.3 Reading + Science (two-pane)

Same as English but the passage rendering differs:
- **Reading**: prose body, no markers, fully scrollable in the left pane. The questions navigate by question number — they don't reference specific passage spots.
- **Science**: prose body + inline stimuli. The `stimuli` jsonb is iterated and rendered:
  - `{ kind: 'table', caption, data: [[...]] }` → HTML `<table>` with caption
  - `{ kind: 'figure', caption, data: { axes, series } }` → simple SVG line/bar chart (no charting library; dependency-free per spec)

For mobile: the two-pane collapses to stacked layout. A sticky "Show passage" button toggles between passage and question views.

The pane splitter on desktop is resizable (drag handle); persisted across sessions in localStorage. Minimum widths enforced (passage >= 30%, question >= 30%).

### 5.4 Break Screen

A centered card with:
- "Section 2 of 4 complete." 
- Countdown: "10:00" → "0:00"
- Big button: "Resume Reading early" (calls `start_section('reading')` and navigates)
- When timer hits 0: auto-navigates.

### 5.5 Results Screen

Composite score (huge centered "29/36") + 4 cards for per-section scaled scores. Below: link to "Review this test" (goes to `/dashboard/attempts/[id]`) + "Return to dashboard".

---

## 6. Server Actions

`app/lib/persistence/actions.ts`:

```ts
'use server';
import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function startSection(attemptId: string, section: ActSection): Promise<void>;
export async function submitSection(attemptId: string, section: ActSection, responses: SubmitResponse[]): Promise<SectionResult>;
export async function forceLockSection(attemptId: string, section: ActSection): Promise<SectionResult>;
export async function finalizeAttempt(attemptId: string): Promise<FinalResults>;
export async function upsertResponse(attemptId: string, questionId: string, selected: 'A'|'B'|'C'|'D'|null, flagged: boolean): Promise<void>;
```

Each action:
- Validates zod input
- Calls the corresponding `act.<rpc>` via the SSR supabase client (RLS + security-definer enforces user scoping at the DB layer)
- Throws on RPC error (caller's responsibility to surface)
- Calls `revalidatePath` for the dashboard after `finalizeAttempt`

`upsertResponse` is special: called fire-and-forget from the test runner on every answer/flag change. It must be FAST. Implementation: client component uses TanStack Query mutation with no optimistic-rollback (the local state is already optimistic).

---

## 7. Score Scaling

The score scale was seeded in Foundation (linear-interp 1-36 per section). The `act.submit_section` RPC does:

```sql
v_raw := (select count(*) from act.attempt_responses ar
  join act.questions q on q.id = ar.question_id
  where ar.attempt_id = p_attempt and ar.section = p_section and ar.is_correct);

select scaled_score into v_scaled from act.score_scales
  where section = p_section and raw_score = v_raw;
```

Composite (in `finalize_attempt`):

```sql
v_included_scaled := array[]::numeric[];
v_included_scaled := v_included_scaled || (scaled_scores->>'english')::numeric;
v_included_scaled := v_included_scaled || (scaled_scores->>'math')::numeric;
v_included_scaled := v_included_scaled || (scaled_scores->>'reading')::numeric;
if include_science then
  v_included_scaled := v_included_scaled || (scaled_scores->>'science')::numeric;
end if;
v_composite := round((select avg(s) from unnest(v_included_scaled) as s)::numeric)::smallint;
```

---

## 8. Resume on Reconnect

Every page-load of `/test/[attemptId]/<section>` does this on mount:

1. Server component fetches `act.get_my_attempt(attemptId)` (cached in TanStack Query as the attempt-snapshot).
2. Reads `current_section` from the result.
3. If `current_section !== <route's section>`, redirect to `/test/[attemptId]/{current_section}`.
4. If `section_state[current_section].locked === true`, redirect to next section.
5. If `now() > section_state[current_section].ends_at + 10s`, fire `forceLockSection` then redirect.
6. Else: read `initialResponses` from the snapshot, mount `useTestSession`, and render.

Combined with the `current_section` server-side guard, this means the user can't escape a locked section nor jump ahead.

---

## 9. Sub-project Boundaries

**What #5 (Analytics) gets from #4:**
- `act.test_attempts` and `act.attempt_responses` are populated with real data
- `composite` and `scaled_scores` columns are reliable

**What #6 (Admin) gets from #4:**
- Real attempt + response data to display

**What this sub-project does NOT do:**
- Analytics page (no aggregation logic; just listing of past attempts)
- Admin moderation UI
- Flag-bad-question UI

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `upsertResponse` flood on rapid-clicking | Debounce on client (200ms); coalesce per question |
| Client clock drift causes early auto-submit | Server-side `ends_at` is the truth; server rejects submissions after deadline + 10s grace; client uses `ends_at` for display only |
| User refreshes mid-section and loses unsaved answers | All answers are persisted via `upsertResponse` on each selection (not buffered locally) |
| `act.draw_test` returns insufficient questions due to thin pool | Spec §1 of AI sub-project notes the warm-pool workflow; `draw_test` raises a clear error pre-attempt |
| Stimuli rendering breaks on malformed table/figure JSON | StimulusRenderer has try/catch fallback to raw JSON dump for that stimulus only; other stimuli on the passage still render |
| Break timer is just UX (server doesn't enforce 10 min) | Documented: spec §4.4 of overview says break is tracked but not enforced |
| Two-pane resizer breaks on small viewports | Stacked layout below 768px; sticky "Show passage" toggle |

---

## 11. Open Questions Resolved

| Question | Decision |
|----------|----------|
| Live correctness feedback during a section | No. `is_correct` is NULL until `submit_section`. Matches real ACT proctoring. |
| Pause/resume mid-section | No pause; only resume after refresh. The clock keeps ticking. |
| Show timer for break? | Yes, prominently, plus a "Resume Reading early" button. |
| Cross-section navigation | No, ever, during an active attempt. |
| Math calculator | Not in v1. Real ACT allows calculators on the Math section; adding one is a clear sub-project #5+ enhancement. |
| Score scale calibration | v1 linear-interp from Foundation; future migration can swap. |

---

## 12. References

- Overview spec: `2026-05-26-act-app-overview-design.md` (§3.5, §3.11, §4, §6, §7 sub-project #4)
- SAT precedent:
  - `Personal/satpracticereact/sat-app/app/components/{SatPractice,TestScreen,QuestionView,QuestionNavigator,ResultsScreen,ReviewItem,StartScreen,TopBar,AppHeader}.tsx`
  - `Personal/satpracticereact/sat-app/app/hooks/useTestSession.ts`
  - `Personal/satpracticereact/sat-app/app/lib/persistence/{actions,payload,queries,schema}.ts`
