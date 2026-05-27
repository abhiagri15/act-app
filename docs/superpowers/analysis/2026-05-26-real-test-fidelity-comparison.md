# Real-Test Fidelity Comparison: SAT App vs ACT App

> A side-by-side audit of how closely each app mirrors its real test. Used to identify gaps where ACT should be brought up to SAT's standard.

**Date:** 2026-05-26
**Status:** Initial audit — feeds into Track B fixes

---

## Methodology

For each real-test feature, mark:
- ✅ — implemented faithfully
- ⚠️ — implemented but with documented simplification
- ❌ — not implemented
- N/A — not part of this test's real format

---

## Feature-by-feature comparison

### Test structure

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| Section count | ✅ 2 sections (R&W, Math) | ✅ 4 sections (English, Math, Reading, Science) | Both faithful |
| Section-locked timers | ✅ | ✅ | Both faithful |
| Mandatory mid-test break | N/A (SAT digital break is between modules, not sections) | ✅ 10 min after Math, "Resume Reading early" supported | Both faithful |
| No cross-section navigation | ✅ | ✅ (stricter — no going back, ever) | Both faithful |
| Optional Science (ACT only, post-2025) | N/A | ✅ pre-test toggle in `/test/new` | Faithful |
| Resume on refresh | ✅ | ✅ via `current_section` + `section_state.ends_at` server-truth | Both faithful |

### Test format

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| Adaptive (Digital SAT only) | ✅ Module 1 + Module 2 (Easier/Harder) routing | N/A — Enhanced ACT is fixed-form | Both correct |
| Passage-based sections | ✅ inline per-question passages for R&W | ✅ 5 English passages × 10q + 4 Reading × 9 + 7 Science (3+3+1 mix) + 45 Math standalone | Both faithful; ACT structurally distinct |
| English `[[N]]` markers | N/A | ✅ inline-marker layout for English passages | Faithful to real ACT digital UI |
| Two-pane passage layout | N/A (SAT R&W is single-pane per-question) | ✅ resizable two-pane for Reading + Science, stacked on mobile | Faithful |
| Question types per section | ✅ R&W: 5 skills; Math: 8 skills with SPR ≈ 25% | ⚠️ English/Math/Reading/Science: 3 skills each; **all MCQ (no SPR)** | ACT correct (Enhanced ACT Math is all MCQ) |

### Question content

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| Multiple-choice (4 options) | ✅ | ✅ (A/B/C/D) | Both faithful |
| Student-Produced Response (SPR / grid-in) | ✅ ≈25% of Math | N/A (Enhanced ACT Math is MCQ-only) | Both correct for their test |
| Math reference sheet | ✅ `<ReferencePanel/>` per real SAT | ❌ Not provided — **and correct**: real ACT does NOT provide one | ACT correct |
| Math calculator | ✅ `<CalculatorPanel/>` (Desmos scientific iframe) — real Digital SAT default | ❌ Not provided — **GAP**: real ACT permits any calculator on Math | **ACT gap — add a Desmos panel for parity** |
| Passages with embedded data (Science) | N/A | ✅ `stimuli` jsonb with table + figure rendering via `<StimulusRenderer/>` | Faithful |
| Reading: paired passages with synthesis | N/A (this is an ACT feature) | ❌ Each passage is standalone | **Minor gap — defer** |
| English passage style variety | N/A | ⚠️ One generic `english_essay` prompt; real ACT has narrative/informational/persuasive variety | **Minor gap — improve prompt diversity** |
| Per-difficulty item calibration | ✅ `easy/medium/hard` cells; planner per (section, skill, difficulty) | ❌ All `difficulty=3` (medium) in v1 | **GAP — bring up to SAT standard** |

### Scoring

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| Section scaled score | ✅ 200-800 per section via real DSAT curve (`RW_CURVE`/`MATH_CURVE`) — also fork to Easier/Harder paths in adaptive | ⚠️ 1-36 per section via **linear interpolation** (raw 0 → 1, raw max → 36) | **GAP — replace with real published ACT scale** |
| Composite score | ✅ 400-1600 (sum of 200-800 sections) — real SAT does the same | ✅ 1-36 (mean of included section scales) — real ACT does the same | Both faithful to test rule |
| Server-trusted scoring | ✅ `save_attempt` recomputes `scaled_score` server-side | ✅ `submit_section` looks up scale from `act.score_scales` server-side | Both faithful |
| No wrong-answer penalty | ✅ | ✅ | Both faithful |
| Sub-scores (analytic/cross-test) | ⚠️ skill-level analytics only; no real "sub-scores" labels | ⚠️ same — skill-level only | Both at parity |
| Composite rounding | ✅ JS↔SQL parity asserted | ✅ `round(...::numeric)` to avoid banker's rounding | Both faithful |

### Generation pipeline

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| AI-generated practice questions | ✅ Ollama Cloud DeepSeek | ✅ Same | Equivalent |
| Self-verify (model re-solve) | ✅ | ✅ | Equivalent |
| Multi-validity check (catches "two valid answers") | ✅ `findValidChoices` | ⚠️ **deferred** | **GAP — fix in Track A (in progress)** |
| Repair multi-valid candidates | ✅ `repairMultiValid` | ❌ deferred — just reject | Minor gap; can defer if rejection rate is acceptable |
| Letter-reference regex repair in explanations | ✅ `repairLetterRefs()` in n8n | ❌ relies only on prompt instruction | **Minor gap — add belt-and-suspenders** |
| Dedup hash UNIQUE constraint | ✅ | ✅ | Equivalent |
| n8n hourly top-up + Vercel daily cron | ✅ | ✅ + callable Config workflow | Equivalent / better (config externalized) |
| Per-skill / per-difficulty floor gate | ✅ dual gate (per-user buffer + skill floor) | ⚠️ thinnest-bucket only; no per-user buffer; no per-difficulty | **GAP — partial bring-up** |
| Seed BANK fallback | ✅ in-code 33-question seed | ❌ relies on `warm-pool.ts` script | Pragmatic divergence (documented); leaves a cold-start gap |

### UI / UX

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| AppHeader with sign-out + dashboard nav | ✅ | ✅ | Equivalent |
| Dashboard with attempt history | ✅ | ✅ | Equivalent |
| Pre-test screen | ✅ length picker | ✅ Science toggle (the only ACT-specific choice) | Both faithful |
| Number palette (answered/flagged/unanswered) | ✅ | ✅ | Equivalent |
| Flag button on each question | ✅ inside `<ReviewItem/>` | ✅ same component pattern | Equivalent |
| Review-view in last 5 minutes | ✅ | ⚠️ in spec (§4.3), partial in implementation (`isReviewing` flag exists) | Verify in code |
| Per-attempt review page | ✅ | ✅ | Equivalent |
| Daily attempt limit | ✅ `sat.app_config.daily_attempt_limit` | ✅ `act.app_config.daily_attempt_limit` | Equivalent |
| Admin moderation UI | ✅ /admin/questions, /admin/users, /admin/flags, etc. | ✅ same shape | Equivalent |
| Per-user analytics drill-through (admin) | ✅ | ✅ | Equivalent |
| Generation log (admin) | ✅ | ✅ + `started_at` now set explicitly (Track 0 fix) | Equivalent |

### Auth

| Real-test feature | SAT app | ACT app | Verdict |
|---|---|---|---|
| Email + password | ✅ | ✅ | Equivalent |
| Google OAuth | ✅ | ✅ | Equivalent |
| Role-escalation guard on profile.role | ✅ `protect_profile_role` trigger | ✅ same trigger (SECURITY INVOKER after Track 0 cleanup) | Equivalent |
| Middleware route gating | ✅ | ✅ | Equivalent |
| `requireAdmin()` 404 not 403 | ✅ | ✅ | Equivalent |

---

## Verdict: where ACT is BELOW SAT's bar on real-test fidelity

Ordered by impact:

### 1. Multi-validity gate ⚠️ → ✅
**Track A (in progress).** Adds `findValidChoices` post-solve check; rejects candidates with > 1 valid answer.

### 2. Real published ACT score scale ⚠️ → ✅
**Track B fix #1.** Replace the linear-interp 1-36 mapping with a real ACT scale (from the "Preparing for the ACT" 2023-2024 booklets or equivalent). Migration-only; no code change.

### 3. Per-difficulty targeting ❌ → ✅
**Track B fix #2.** Make the planner pick (passage_type, difficulty) cells and (math_skill, difficulty) cells. Update prompts to honor the requested difficulty.

### 4. Letter-reference repair regex ❌ → ✅
**Track B fix #3.** Mirror SAT's `repairLetterRefs()` pass — strips "Choice A" / "Option B" references from explanations before insert.

### 5. Calculator panel on Math ❌ → ✅
**Track B fix #4 (optional).** Add a Desmos calculator iframe (mirror SAT's `<CalculatorPanel/>`). Real ACT permits any calculator on Math; this is a parity-with-SAT feature.

### 6. English passage style diversity ⚠️ → ✅
**Track B fix #5 (optional).** Make `english_essay` prompt randomly pick a style per generation (narrative / informational / persuasive). Improves content variety.

### 7. Per-user buffer + dual-gate generator ⚠️ → ✅
**Deferred.** SAT's generator has a `min_active_user_unseen` SQL function that triggers generation when ANY active student's unseen-question buffer drops. ACT v1 generates against absolute target counts. Less critical at low user volumes; revisit at scale.

### 8. Seed BANK fallback ❌
**Deferred — operational workaround exists (`warm-pool.ts`).** Not adding 60-90 hand-written items is a deliberate cost-of-bootstrap trade-off documented in AI spec §7.

### 9. Repair multi-valid candidates ❌
**Deferred — rejection rate acceptable.** ACT just drops bad candidates; n8n hourly + Vercel daily backfill the slot. SAT's repair adds 2-3 more Ollama calls per candidate; given ACT's lower volume, rejection is cheaper.

### 10. Reading: paired passages with synthesis ❌
**Deferred.** Real ACT has 1 paired-passage set in Reading; our model generates 4 standalone passages. Minor fidelity gap; defer.

---

## Track B execution order

1. Multi-validity gate (Track A — DISPATCHED, in progress)
2. **Real ACT score scale** (highest user-visible impact)
3. **Per-difficulty targeting** (improves both generation AND test composition)
4. **Letter-reference repair** (cheap defensive fix)
5. **Calculator panel** (parity with SAT; optional)
6. **English passage diversity** (prompt-only change; optional)

Items 7-10 deferred per analysis above.

---

## Estimated work

| Fix | Effort | Implementation |
|---|---|---|
| Multi-validity (Track A) | ~1.5h | One subagent, code + n8n |
| Real ACT score scale | ~30min | Migration-only |
| Per-difficulty targeting | ~3h | Schema usage + planner + prompts + n8n |
| Letter-reference repair | ~30min | Regex pass in `runGeneration` + n8n parse node |
| Calculator panel | ~1h | New component, mount on Math runner |
| English passage diversity | ~30min | Prompt-only update |

Total Track B = ~5 hours of subagent work.

---

## Success bar after Track B

After all Track B fixes land:

1. Supabase advisor still at the same baseline (no new WARNs introduced)
2. ACT `runGeneration` mirrors SAT's pipeline: solve + multi-validity (no repair)
3. ACT score scale matches a publicly-cited ACT form rather than linear-interp
4. AI-generated questions carry meaningful difficulty labels (1-5 per spec §3.3)
5. Math runner offers an embedded calculator
6. English passages vary in style across generations

ACT is then at parity with SAT in everything except: SPR support (N/A for ACT), adaptive routing (N/A for ACT), and the deferred items 7-10 above.
