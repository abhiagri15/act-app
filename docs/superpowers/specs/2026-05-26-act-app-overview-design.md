# ACT Practice App — Overview Design

> Cross-cutting design spec for `act-app`, a 7-sub-project mirror of `sat-app` retargeted at the Enhanced ACT (2025+) format. Each sub-project will get its own narrower spec when its turn comes; this document is the contract those specs build against.

**Date:** 2026-05-26
**Status:** Approved
**Companion app:** `Personal/satpracticereact/sat-app` (architectural precedent)

---

## 1. Scope & Goals

Build `act-app`, an Enhanced ACT (2025+) practice platform that gives students near-test-day fidelity in the browser:

- Section-locked timers with auto-submit
- Mandatory 10-minute break after Math
- 4-section composite scoring on the 1–36 scale
- Passage-based Reading and Science (one passage drives multiple questions)
- Longitudinal analytics across attempts
- Hourly question pool refresh via n8n

The architectural spine is identical to `sat-app` so patterns transfer cleanly. The differences from SAT are confined to test content, gameplay, and scoring.

**Core contract:** SAT app's *infrastructure spine* carries over verbatim. ACT-specific work is concentrated in question content, format, rendering, and scoring.

### Out of scope (v1)

- Writing essay (any form — no editor, no AI grading, no prompt display)
- Classic (pre-2025) ACT format
- Relaxed / untimed practice mode
- Skill drills shorter than a full section
- Mobile-native app (responsive web only)
- PDF score reports

### Success bar

A student can:
1. Sign in with email or Google.
2. Start a full timed Enhanced ACT (Science optional via pre-test toggle).
3. Move through section-locked timers with a mandatory break after Math.
4. Receive a composite score (1–36) + per-section scaled scores on completion.
5. View attempt history and per-skill analytics.
6. Flag bad questions.

…and the question pool refreshes hourly via n8n with no admin intervention.

---

## 2. Tech Stack & Deployment

Identical to `sat-app`:

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TypeScript strict, Tailwind + shadcn/ui |
| Package manager | pnpm |
| Auth & DB | Supabase (`@supabase/ssr`) |
| State / data | TanStack Query |
| Forms | react-hook-form + zod |
| Hosting | Vercel (autodeploy on push to `main`) |
| Question generator | n8n workflow on `abhishek15.n8n-wsk.com` |
| AI provider | Ollama Cloud (DeepSeek), behind pluggable provider interface |

### Repo & deploy layout

- **Code:** `Personal/actpracticereact/act-app/`
- **GitHub:** new repo `github.com/abhiagri15/act-app`
- **Vercel:** new project, autodeploy from `main`
- **Sub-projects land directly on `main`** with tags (`post-foundation` → … → `post-feedback`)
- **Tag chain:** `pre-init` → `post-foundation` → `post-auth` → `post-ai` → `post-persistence` → `post-analytics` → `post-admin` → `post-feedback`

### Secrets

- `.env.local` gitignored; every variable hand-set in Vercel Environment Variables (Supabase URL + anon + service-role keys, AI provider vars, `CRON_SECRET`).
- `NEXT_PUBLIC_*` vars are inlined at build time — redeploy after any env change, not just save.
- Pin `next` to a patched release from day one (Vercel hard-fails deploys for known-CVE versions).

### Database

- **Same Supabase project as SAT:** PropLedger (`falgykkspbtrwdcchayi`).
- **New schema:** `act`. Must be added to project's Exposed Schemas, or `getOrCreateProfile` fails (same gotcha as `sat`).
- **Auth:** shared `auth.users` with SAT, but separate `act.profiles` (one row per user, mirrors `sat.profiles`).

### Supabase URL configuration

- Site URL: Vercel production URL (e.g. `https://act-app-<hash>.vercel.app`)
- Redirect URLs allow-list: production URL `/**` + `http://localhost:3000/**`

---

## 3. Data Model (`act` schema)

Eight tables. All RLS-enabled with **select-only** policies; writes go exclusively through **security-definer RPCs** that set `user_id := auth.uid()` themselves. This pattern is inherited from SAT and must not be deviated from — add new write paths as security-definer functions, never a write policy.

### 3.1 `act.profiles`

Mirrors `sat.profiles` shape.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users.id` |
| `email` | text | denormalized |
| `full_name` | text | nullable |
| `avatar_url` | text | nullable |
| `role` | text | `'student'` \| `'admin'`, default `'student'`. **Not user-writable** — guarded by a BEFORE INSERT/UPDATE trigger (`protect_profile_role`) that forces the value back to `'student'` (insert) or the prior value (update) for `anon`/`authenticated` roles. Promotion happens via direct `UPDATE` as `service_role`. |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`, maintained by `set_updated_at` BEFORE UPDATE trigger |

### 3.2 `act.passages`

Shared passage pool for English, Reading, and Science. Multiple `act.questions` rows point to the same passage. (English on the real Enhanced ACT is passage-based: 5 passages with embedded underlined/numbered portions, ~10 questions per passage — not independent items.)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` (filled by trigger) |
| `section` | text | `'english'` \| `'reading'` \| `'science'` |
| `passage_type` | text | English: `english_essay`. Reading: `literary_narrative`, `social_science`, `humanities`, `natural_science`. Science: `data_representation`, `research_summaries`, `conflicting_viewpoints` |
| `title` | text | |
| `body` | text | markdown. For English: includes inline markers `[[1]]`, `[[2]]`, … that each question references by `passage_marker` |
| `stimuli` | jsonb | Science only: array of `{kind: 'table' \| 'figure', caption, data}` |
| `enabled` | bool | default `true` |
| `dedup_hash` | text UNIQUE | filled by trigger |
| `created_at` | timestamptz | |

**Fixed questions-per-passage contract** (a `PASSAGE_QUESTION_COUNTS` constant in `app/lib/act/format.ts`, enforced by both `act.draw_test` and the n8n generator):

| passage_type | questions |
|--------------|-----------|
| `english_essay` | 10 |
| `literary_narrative` / `social_science` / `humanities` / `natural_science` | 9 |
| `data_representation` | 5 |
| `research_summaries` | 6 |
| `conflicting_viewpoints` | 7 |

### 3.3 `act.questions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` (filled by trigger) |
| `section` | text | `'english'` \| `'math'` \| `'reading'` \| `'science'` |
| `skill` | text | see skill taxonomy below |
| `difficulty` | smallint | 1–5 |
| `passage_id` | uuid | nullable FK → `act.passages`. **Required for English, Reading, Science; null for Math** |
| `passage_marker` | smallint | nullable. English only: which `[[N]]` marker in the passage body this question targets (`null` for non-English) |
| `stem` | text | markdown |
| `choices` | jsonb | `[{key:'A',text}, {key:'B',text}, {key:'C',text}, {key:'D',text}]` |
| `answer_key` | text | `A` \| `B` \| `C` \| `D` |
| `explanation` | text | markdown |
| `enabled` | bool | default `true` (soft-disable via admin) |
| `dedup_hash` | text UNIQUE | filled by trigger |
| `created_at` | timestamptz | |

### 3.4 Skill taxonomy

12 skill buckets total (4 sections × 3 skills) — drives the n8n thinnest-skill picker:

- **English:** `production_of_writing`, `knowledge_of_language`, `conventions_of_standard_english`
- **Math:** `preparing_for_higher_math`, `integrating_essential_skills`, `modeling`
- **Reading:** `key_ideas_and_details`, `craft_and_structure`, `integration_of_knowledge`
- **Science:** `interpretation_of_data`, `scientific_investigation`, `evaluation_of_models`

### 3.5 `act.test_attempts`

Holds the full mutable state of an in-progress attempt; survives refresh.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `auth.users` |
| `started_at` | timestamptz | |
| `submitted_at` | timestamptz | nullable |
| `status` | text | `'in_progress'` \| `'submitted'` \| `'abandoned'` |
| `include_science` | bool | default `true`; if false, Science is skipped and composite averages 3 sections |
| `current_section` | text | nullable; one of `'english'`, `'math'`, `'break'`, `'reading'`, `'science'` |
| `section_state` | jsonb | Keyed by `'english'`, `'math'`, `'break'`, `'reading'`, `'science'`. Each value: `{started_at, ends_at, submitted_at, locked}`. The `'break'` entry uses the same shape (`submitted_at`/`locked` set when user resumes Reading); not graded |
| `raw_scores` | jsonb | per-section integer raw counts |
| `scaled_scores` | jsonb | per-section 1–36 |
| `composite` | smallint | nullable until finalize |

### 3.6 `act.attempt_responses`

| Column | Type | Notes |
|--------|------|-------|
| `attempt_id` | uuid | FK |
| `question_id` | uuid | FK |
| `section` | text | denormalized for analytics queries |
| `selected` | text | nullable; `A`–`D` |
| `is_correct` | bool | nullable |
| `flagged` | bool | default `false` (in-test flag, not the bad-question report) |
| `answered_at` | timestamptz | |

PK: `(attempt_id, question_id)`.

### 3.7 `act.score_scales`

Raw → scaled (1–36) lookup per section.

| Column | Type | Notes |
|--------|------|-------|
| `section` | text | |
| `raw_score` | int | |
| `scaled_score` | smallint | 1–36 |

PK: `(section, raw_score)`. **v1 seed:** a smooth linear-interpolation approximation per section (raw 0 → scaled 1, raw N_max → scaled 36) — sufficient to exercise the round-trip end-to-end and produce a sensible score band; not calibrated to any specific published form. **v2 (`supabase/migrations/20260526070000_act_score_scales_v2.sql`, superseded):** replaced the linear curve with a power-function curve `scaled = round(1 + 35 * (raw/max_raw)^EXPONENT)` clamped `[1, 36]`. Per-section exponents were English/Reading `0.65` and Math/Science `0.70` — concave (exponent < 1) so the middle of the range was more forgiving than the linear v1; still synthetic. **v3 (live, `supabase/migrations/20260526080000_act_score_scales_v3.sql`):** replaces the synthetic power-function with the **rescaled published Classic ACT scale** taken from ACT's "Preparing for the ACT 2021-2022" booklet (English 75 / Math 60 / Reading 40 / Science 40). The Enhanced raw is mapped to a Classic-equivalent raw via `classic_equivalent_raw = round(enhanced_raw * classic_max / enhanced_max)`, then the Classic scaled score is looked up directly. Science (Enhanced 40 = Classic 40) requires no rescaling and uses the Classic Science table as-is; English (50→75, ×1.5), Math (45→60, ×1.333…), and Reading (36→40, ×1.111…) rescale. Per-form variation on Classic ACT is ±1–2 points; the chosen form is representative. Per-section row counts are unchanged (51/46/37/41 = 175 total). **Upgrade path:** drop in another published table (different form, or a future Enhanced-native table once ACT publishes one) via a v4 migration — same shape, single SQL file, no app code change.

Composite = `round(mean(included section scaled scores))`. If `include_science=false`, composite = `round((english + math + reading) / 3)`.

### 3.8 `act.question_flags`

Mirrors SAT structure. User-reported bad-question reports.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | |
| `question_id` | uuid | |
| `reason` | text | enum-like (`incorrect_answer`, `ambiguous`, `typo`, `other`) |
| `notes` | text | nullable |
| `status` | text | `'open'` \| `'resolved'` \| `'dismissed'` |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | nullable |

### 3.9 `act.generation_runs`

n8n bookkeeping (admin debug).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | nullable |
| `skill` | text | which skill/passage-type was targeted |
| `target` | int | desired produced count |
| `produced` | int | actual |
| `errors` | jsonb | array of error objects |

### 3.10 Triggers

- `act.passages_fill_defaults` — fills `id` (uuid v4) and `dedup_hash` (sha256 of section+passage_type+body) on insert.
- `act.questions_fill_defaults` — fills `id` and `dedup_hash` (sha256 of section+skill+stem+choices) on insert.

n8n inserts omit these columns.

### 3.11 Security-definer RPCs

All RPCs that mutate or expose user-scoped data:

- `act.draw_test(p_include_science bool)` → assembles an attempt:
  - Picks **5 English passages** (`english_essay`) + all 10 of each passage's questions = 50 items.
  - Picks **4 Reading passages** (one per Reading `passage_type`) + all 9 of each passage's questions = 36 items.
  - Picks **7 Science passages** (3 `data_representation` × 5q + 3 `research_summaries` × 6q + 1 `conflicting_viewpoints` × 7q = 40 items), only if `p_include_science=true`.
  - Picks **45 Math questions** from `act.questions` with `passage_id IS NULL` and a skill mix targeting ACT proportions; respects per-user no-repeat against prior `attempt_responses`.
  - **Cold-start fallback (partial pool):** if any required slot can't be filled from `act.questions`/`act.passages` after applying no-repeat, falls back to the in-code seed BANK (see 5.7) to pad to the required count. Pool exhaustion never blocks an attempt.
  - Creates `act.test_attempts` row with `status='in_progress'`, `current_section=null` (not yet started).
  - **Return shape** (answer keys stripped server-side):
    ```
    {
      attempt_id: uuid,
      include_science: bool,
      passages: [{ id, section, passage_type, title, body, stimuli }],  // top-level dedup'd array
      sections: {
        english:  [{ question_id, passage_id, passage_marker, stem, choices }],
        math:     [{ question_id, stem, choices }],
        reading:  [{ question_id, passage_id, stem, choices }],
        science:  [{ question_id, passage_id, stem, choices }]
      }
    }
    ```
- `act.start_section(p_attempt uuid, p_section text)` → sets `section_state[section] = {started_at: now(), ends_at: now() + duration, submitted_at: null, locked: false}`, updates `current_section`. Validates section sequence (English → Math → Break → Reading → Science).
- `act.submit_section(p_attempt uuid, p_section text, p_responses jsonb)` → grades, writes `act.attempt_responses`, sets `submitted_at` + `locked: true`, computes section raw score → scaled via `act.score_scales`. Rejects if `now() > ends_at + 10s grace` (server-side timer enforcement).
- `act.force_lock_section(p_attempt uuid, p_section text)` → idempotent. Called by the client on resume when `now() > ends_at`. Internally finalizes the section using whatever responses are already persisted to `act.attempt_responses`. Safe to call repeatedly; no-op if section already locked.
- `act.finalize_attempt(p_attempt uuid)` → computes composite (`round(mean(included scaled scores)::numeric)` — cast to numeric to avoid double-precision banker's rounding), marks `submitted_at`, sets `status='submitted'`.
- `act.submit_flag(p_question uuid, p_reason text, p_notes text)`.
- `act.user_analytics()` security-**invoker** → returns trends, per-section, per-skill rollups for the calling user.
- `act.cleanup_abandoned_attempts()` (admin/cron) → marks `status='abandoned'` for in-progress attempts older than 24h.

### 3.12 RLS posture

All tables: RLS enabled. Policies are **select-only** scoped to `auth.uid()` where applicable. No write policies. New write paths = new security-definer function. This is the same load-bearing pattern as SAT and is non-negotiable.

---

## 4. Test Session State Machine

Server-driven section state with client-side timer display. The server (`section_state` jsonb on `act.test_attempts`) is the source of truth; client clock is for UX only.

### 4.1 Section sequence

```
english (35 min) → math (50 min) → BREAK (10 min) → reading (40 min) → [science (40 min)] → submitted
```

Durations per Enhanced ACT (2025+):

| Section | Questions | Duration |
|---------|-----------|----------|
| English | 50 | 35 min |
| Math | 45 | 50 min |
| Break | — | 10 min |
| Reading | 36 | 40 min |
| Science | 40 | 40 min (optional) |

### 4.2 Per-section lifecycle

1. **Start:** `start_section` RPC sets `section_state[section] = {started_at: now(), ends_at: now() + duration, submitted_at: null, locked: false}` and updates `current_section`.
2. **Run:** Client renders countdown from `ends_at - now()`. Answer selections write optimistically to `act.attempt_responses` so a refresh / accidental close doesn't lose work.
3. **Auto-submit:** Fires client-side when local clock reaches `ends_at`. Server independently rejects any `submit_section` call with `now() > ends_at + 10s grace`.
4. **Submit:** `submit_section` grades, writes responses, sets `submitted_at` + `locked: true`, computes raw → scaled.
5. **Lock:** Locked sections cannot be re-entered. Client UI hides their routes; server RPCs reject mutations.

### 4.3 Within a section

- Free question navigation (number palette UI like real ACT)
- Flag / unflag any question (`flagged` on `attempt_responses`; persisted past section lock so `/dashboard/attempts/[id]` review can surface "questions you flagged during the test" — distinct from `act.question_flags` which is the bad-question report system)
- "Review" view shows flagged + unanswered, accessible during last 5 minutes
- No cross-section navigation, ever. No "back" button to prior sections.

### 4.4 Break

- After Math `submit_section`, client renders a 10-min break screen with "Resume Reading early" button (real ACT lets you continue early).
- Break time is tracked in `section_state.break` for analytics; not enforced beyond display.
- "Resume Reading early" calls `start_section('reading')` immediately.

### 4.5 Resume on reconnect

- If user refreshes mid-section, client re-reads `current_section` + `ends_at` from server and resumes with correct remaining time.
- If `now() > ends_at` on resume, client calls `act.force_lock_section` (idempotent) explicitly and advances to the next section. No side-effects-of-next-mutation magic.

### 4.6 Abandonment

- In-progress attempts >24h old are swept by `act.cleanup_abandoned_attempts()` (Vercel cron added in Admin sub-project) and marked `status='abandoned'`.
- Abandoned attempts don't count in analytics.

### 4.7 Scoring

- **Section raw** = count of correct responses. No penalty for wrong (matches real ACT).
- **Section scaled** = `act.score_scales` lookup `(section, raw_score) → scaled_score`.
- **Composite** = `round(mean(included section scaled scores))`. If Science skipped: `round((english + math + reading) / 3)`.

---

## 5. AI Question Generation (n8n Workflow)

Same pattern as the SAT generator (workflow `jDjJIthvf6EyKwgR` on `abhishek15.n8n-wsk.com`) with one structural addition: a passage branch for Reading and Science.

### 5.1 Pluggable provider

Lives at `app/lib/ai/`:

- `provider.ts` — interface (`generate`, `solve`)
- `providers/ollama-cloud.ts` — default impl (DeepSeek)
- `prompts/` — section/skill-specific templates
- `generate.ts` — canonical `runGeneration()` (mirrored by n8n; called by Vercel cron fallback)

Swapping models = changing one env var + provider impl, no app code changes.

### 5.2 Buffer targets

The unit of generation is the **passage bucket** (for English/Reading/Science) and the **standalone-question skill bucket** (for Math). Reading/Science/English skills aren't refilled directly — they're refilled as a side effect of generating new passages, whose questions cover the required skill mix.

| Bucket | Target |
|--------|--------|
| English passages (`english_essay`) | 20 |
| Reading passages — each of 4 types | 8 |
| Science passages — `data_representation` | 15 |
| Science passages — `research_summaries` | 15 |
| Science passages — `conflicting_viewpoints` | 8 |
| Math standalone questions — each of 3 skills | 60 |

Plan Batches picks the **thinnest bucket** each run (lowest fill ratio vs. target). Up to `maxBatches=6` per hourly run.

### 5.3 Workflow shape (16 native nodes, two phases)

```
Schedule (hourly)
  → Config (Code; holds SUPABASE_SERVICE_ROLE_KEY, OLLAMA_API_KEY as placeholders)
  → Get Counts (HTTP GET: act.questions and act.passages grouped by bucket)
  → Plan Batches (Code; picks thinnest bucket per 5.2; emits up to maxBatches=6 batches)
  → Switch on batch.kind: 'passage' | 'math_question'

  [passage branch — english/reading/science]
    → Ollama Generate Passage (HTTP, timeout 180s, neverError)
    → Parse Passage (Code; zod-equiv gate; English passages must contain N marker tokens [[1]]..[[N]])
    → Insert Passage (HTTP POST → act.passages; trigger fills id+dedup_hash)
    → Ollama Generate Questions-for-Passage (HTTP; exactly PASSAGE_QUESTION_COUNTS[passage_type] questions)
    → Parse Q Candidates (Code)
    → Ollama Solve & Verify (HTTP; self-check answer keys reference passage stimulus / marker)
    → Insert Questions (HTTP POST → act.questions with passage_id set, passage_marker for English)

  [math_question branch]
    → Ollama Generate Q (HTTP)
    → Parse Q Candidate (Code)
    → Ollama Solve & Verify (HTTP)
    → Insert Question (HTTP POST → act.questions, passage_id null)
```

Node count: 5 shared (Schedule, Config, Get Counts, Plan Batches, Switch) + 7 in passage branch + 4 in math_question branch = **16 nodes**.

**Important:** Reading/Science/English question generation is **always** passage-first. There is no path that generates a passage-bound question without first generating (or selecting from existing) a passage. If a passage bucket is full but a question-skill bucket inside it would benefit from more variety, that variety comes via the next passage's questions, not via standalone insertion.

### 5.4 Inherited gotchas (non-negotiable)

- **Ollama calls MUST be HTTP Request nodes**, not Code. n8n's js-task-runner caps Code at 60s; Ollama is 30–60s per call. HTTP Request nodes accept `options.timeout: 180000`.
- `batching.batch.batchSize: 1` for sequential calls + `neverError: true` so one bad batch doesn't abort the run.
- **Bounded loop:** Plan Batches emits up to 6 batches per run; n8n's per-item execution runs the chain once per batch (no SplitInBatches construct — that has a loop-back-with-0-items footgun).
- One run produces ~12–18 questions (~25 min); buffer reaches target over 2–3 hourly runs; subsequent runs are fast no-ops.
- Secrets are **placeholders in the Config code node**; user pastes them in the n8n UI; downstream nodes reference as `={{ $('Config').first().json.X }}`. **Never commit real secret values to the workflow code shipped via the MCP `create_workflow_from_code` call.**
- DB triggers fill `id` + `dedup_hash`; n8n insert payloads omit them.

### 5.5 Vercel cron redundancy

- Endpoint `/api/admin/generate-questions` invokes canonical `runGeneration()` from `app/lib/ai/generate.ts`.
- Scheduled daily; while n8n is healthy this is a no-op (buffer full).
- Disaster-recovery path if n8n breaks. Same setup as SAT.

### 5.6 Prompt templates

Lives under `app/lib/ai/prompts/`. Two layers:

**Passage prompts (8 total):**
- `english_essay.passage.prompt.ts`
- `reading_literary_narrative.passage.prompt.ts`
- `reading_social_science.passage.prompt.ts`
- `reading_humanities.passage.prompt.ts`
- `reading_natural_science.passage.prompt.ts`
- `science_data_representation.passage.prompt.ts`
- `science_research_summaries.passage.prompt.ts`
- `science_conflicting_viewpoints.passage.prompt.ts`

**Question-for-passage prompts (8 total):** one per passage type, instructs the model to produce exactly `PASSAGE_QUESTION_COUNTS[type]` questions targeting the passage and distributed across the section's 3 skills.

**Standalone-question prompts (3 total):** Math only — `math_preparing_for_higher_math.prompt.ts`, `math_integrating_essential_skills.prompt.ts`, `math_modeling.prompt.ts`.

**Total: 19 prompt files.**

**Science generation risk** — Science passages need plausible fake research methodology + a coherent data table or figure description, and questions must reference specific rows/values. Mitigations:

- Per-Science-type prompt templates (above) with explicit stimulus-format scaffolding.
- Stricter self-verify in the Solve step: must cite a specific row/column/figure label from the passage stimulus.
- Admin bulk-disable path is the safety net — flag bad ones, n8n refills the thinnest bucket.

### 5.7 Seed fallback

Mirror SAT's in-code `BANK`: if `draw_test` finds the pool empty for a section/skill, falls back to an in-code seed of ~30 hand-written questions per section. Removes the cold-start gap before the n8n top-up has run.

---

## 6. UI Surfaces

App Router structure mirrors `sat-app`:

```
app/
├── (auth)/
│   ├── login/, signup/, callback/, reset-password/
├── (app)/
│   ├── dashboard/              → attempt history (composite, date, status)
│   │   └── attempts/[id]/      → per-attempt review
│   ├── test/
│   │   ├── new/                → "Start full test" + Science toggle + confirm modal
│   │   └── [attemptId]/
│   │       ├── english/, math/, reading/, science/   → section runners
│   │       ├── break/          → 10-min break screen with "Resume Reading early"
│   │       └── results/        → composite + per-section + skill breakdown
│   ├── analytics/              → trends, per-section, per-skill, focus areas
│   ├── admin/                  → admin-only: pool moderation
│   │   ├── passages/           → passage moderation
│   │   ├── generation/         → generation_runs log
│   │   └── flags/              → user-flagged questions review
│   └── how-it-works/           → static explainer
├── api/
│   └── admin/generate-questions/  → Vercel cron fallback
└── components/
    ├── test/                   → Timer, NumberPalette, PassagePane, QuestionPane, FlagButton, BreakScreen
    ├── review/                 → ReviewItem (reused: attempt review + admin moderation + flag UI)
    └── ui/                     → shadcn
```

### 6.1 Layout conventions

- **Two-pane** for English, Reading, and Science.
  - **English**: passage left with inline `[[N]]` markers rendered as highlighted/underlined targets; clicking marker `N` (or navigating to the Nth question via the palette) scrolls the passage to that marker and shows the corresponding question on the right pane.
  - **Reading / Science**: passage left (scrollable; Science includes inlined tables/figures from `stimuli`); question + 4 choices right.
  - Resizable splitter on desktop; stacked on mobile with sticky "Show passage" toggle.
- **Single-pane** for Math only (no passage).
- **Number palette** across the bottom shows answered / flagged / unanswered for the current section only.
- **Section header** shows section name + countdown (red below 5 min) + "Review" button (last 5 min only).
- **No cross-section nav** during an active attempt — header has no "back" / "dashboard" links until submission.

### 6.2 Pre-test flow

- `/test/new` shows: full-test summary (sections, durations), Science toggle ("Include Science section — most students take this; skip only if your target schools accept the 3-section composite"), Start button.
- Confirm modal: "You can't pause once started. Section timers are locked. Ready?"

### 6.3 Admin surfaces

- `/admin` — paginated question pool with filter by section/skill/enabled, soft-disable toggle (sets `enabled=false`, filtered out by `act.draw_test`).
- `/admin/passages` — same for passages; disabling a passage cascades-hides its children questions from draws.
- `/admin/flags` — open flags, resolve/dismiss with notes.
- `/admin/generation` — last 50 `act.generation_runs` rows.

### 6.4 ReviewItem component

Same workhorse pattern as SAT — used in `/dashboard/attempts/[id]`, admin moderation, and the flag flow. Shows: stem, choices with correct + selected highlighted, explanation, "Flag this question" button.

---

## 7. Sub-Project Breakdown

Seven sub-projects, mirroring the SAT sequence. Each has its own spec → plan → subagent-driven execution cycle. Each lands on `main` with a tag.

### #1 Foundation → `post-foundation`

- Scaffold Next 15 + TS strict + pnpm + Tailwind/shadcn
- Supabase clients (`@supabase/ssr`), TanStack Query, providers
- Create `act` schema; migrations for all 8 tables, RLS select-only policies, triggers
- Seed `act.score_scales` from a published ACT scale table (per 3.7)
- Empty placeholder home + how-it-works pages
- Vercel project wired, env vars set, **Exposed Schemas includes `act`**
- GitHub repo created, `main` branch initialized
- **Verification step (load-bearing):** confirm via Supabase MCP `list_tables` that `act` schema is in Exposed Schemas — `getOrCreateProfile` will silently fail later otherwise.

### #2 Auth → `post-auth`

- Email/password + Google OAuth via `@supabase/ssr`
- `act.profiles` auto-created on first login (trigger or `getOrCreateProfile`)
- Middleware route gating: signed-out → login; admin routes → `requireAdmin()`
- Supabase Site URL + Redirect URLs configured for Vercel domain

### #3 AI question generation → `post-ai`

- `app/lib/ai/` pluggable provider, **19 prompt files** per 5.6 (8 passage + 8 questions-for-passage + 3 standalone Math)
- `act.draw_test` RPC + dependencies (passage-set assembly per 3.11, cold-start fallback to seed BANK, per-user no-repeat)
- Vercel cron `/api/admin/generate-questions` (canonical `runGeneration()`)
- Build the n8n workflow (16 nodes with passage branch per 5.3)
- In-code seed BANK fallback for cold-start / partial pool (per 5.7)
- **Verification scope:** ends at "`act.draw_test` returns a valid, schema-conformant assembled payload covering all four sections with the correct counts." The end-to-end UI run-through is sub-project #4's responsibility (it requires `start_section` / `submit_section` which don't exist until #4).
- Highest-risk sub-project — budget extra time here, particularly for Science quality.

### #4 Persistence + Test runner → `post-persistence`

- Full test session UI: section runners, timer, palette, two-pane Reading/Science, break, results
- `act.start_section` / `submit_section` / `finalize_attempt` RPCs
- Resume-on-reconnect logic
- `/dashboard` history + `/dashboard/attempts/[id]` review pages

### #5 Analytics → `post-analytics`

- `act.user_analytics()` security-invoker RPC
- `/analytics` page: composite trend, per-section trend, per-skill accuracy, focus areas
- Dependency-free SVG/CSS visuals

### #6 Admin → `post-admin`

- `/admin` + `/admin/passages` + `/admin/generation`
- `enabled` soft-disable filtered by `act.draw_test`
- `requireAdmin()` gate + role-checked service-role writes
- `act.cleanup_abandoned_attempts()` Vercel cron

### #7 Feedback → `post-feedback`

- `act.question_flags` + `submit_flag` RPC
- Flag button on every `ReviewItem`
- `/admin/flags` review/resolve UI

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Passage-question count drift (a Reading passage's generated questions != 9) | Fixed `PASSAGE_QUESTION_COUNTS` constant referenced by both the question-for-passage prompt template AND a hard check in Parse Q Candidates (n8n) — passages that don't yield the exact count are rejected and the batch retries |
| Science question quality is hard to AI-generate | Section-specific prompt templates + stricter self-verify (must cite stimulus row/figure label) + admin bulk-disable as safety net |
| ACT format may shift again before launch | Enhanced ACT is locked into the data model via durations/counts in code, not schema — column types support either format |
| n8n outage halts question refresh | Vercel cron `/api/admin/generate-questions` is the daily fallback |
| Server-client clock drift on auto-submit | 10s grace on server; client auto-submit is UX, server is truth |
| Supabase Exposed Schemas drift | Foundation sub-project verification step explicitly checks `act` is in Exposed Schemas |
| Vercel security gate fails on `next` CVE | Pin to latest patched release in Foundation; bump as part of each sub-project's verification |
| Refresh mid-test loses answers | Optimistic write to `act.attempt_responses` on selection; resume reads `current_section` + `ends_at` from server |
| Pool cold-start (n8n hasn't run yet) | In-code seed BANK fallback in `act.draw_test` |

---

## 9. Open Questions Resolved in This Session

| Question | Decision |
|----------|----------|
| ACT format target | Enhanced ACT (2025+) |
| Repo & data layout | New repo + same Supabase, new `act` schema |
| Writing essay | Skip entirely for v1 |
| Test-day simulation strictness | Strict ACT-day mode |
| Sub-project phasing | Mirror SAT: 7 sub-projects in same order |
| Test-draw model | Passage-set draw (passages table + questions FK) |
| English passage model | English IS passage-based (5 × 10 per real Enhanced ACT). Passages live in `act.passages` with `section='english'`, `passage_type='english_essay'`, and inline `[[N]]` markers; questions carry a `passage_marker` for which marker they target (resolved during spec review). |
| Fixed questions-per-passage | Per-passage-type constants (10/9/9/9/9/5/6/7) enforced by both `draw_test` and n8n Parse Q Candidates gate (resolved during spec review). |

---

## 10. References

- SAT app overview: `Personal/satpracticereact/sat-app/` and its 7 sub-project design docs at `docs/superpowers/specs/2026-05-21-sat-app-*.md`
- SAT app memory: `sat_practice_project.md`
- n8n SDK reference: via MCP `get_sdk_reference`
- Real ACT (Enhanced) format reference: `act.org`
