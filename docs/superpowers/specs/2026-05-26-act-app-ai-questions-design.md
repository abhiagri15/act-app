# ACT App — Sub-project #3 (AI Question Generation) Design

> Narrower spec built against the overview design at `2026-05-26-act-app-overview-design.md`. Sub-project #3 delivers question and passage generation via Ollama Cloud (DeepSeek), the `act.draw_test` RPC that assembles a full test, and the n8n workflow that keeps the pool warm.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-ai`

---

## 1. Scope & Goals

After this sub-project lands, the system can:
1. **Generate questions on demand** via a pluggable `AIProvider` (Ollama Cloud DeepSeek by default).
2. **Generate passage-first content** for English, Reading, and Science — each passage gets a fixed-count question batch attached at insert time.
3. **Assemble a full Enhanced ACT test** via `act.draw_test()` security-definer RPC: 5 English passages × 10q, 4 Reading passages × 9q, 7 Science passages (3 data-rep × 5q + 3 research × 6q + 1 viewpoints × 7q), 45 Math standalone q. Total: 50 + 36 + 40 + 45 = 171 items.
4. **Keep the pool warm** via two redundant top-up paths:
   - **Vercel cron** at `/api/admin/generate-questions` (daily, secret-gated, canonical implementation in `app/lib/ai/generate.ts`)
   - **n8n workflow** on `abhishek15.n8n-wsk.com` (hourly, native HTTP nodes, mirrors `runGeneration()`)
5. **Cold-start gracefully:** if the pool is empty when a user starts a test, `draw_test` falls back to `runGeneration` (synchronous, slow) to populate the gap. There is no hand-written seed BANK — see §7.

**In scope:**
- `app/lib/ai/` module: provider interface, Ollama Cloud impl, 19 prompts (8 passage + 8 questions-for-passage + 3 standalone Math), zod schemas, dedup hashing, canonical `runGeneration()`
- `act.draw_test(p_include_science bool)` security-definer RPC + helper SQL functions
- `/api/admin/generate-questions` Vercel cron route (secret-gated; bypasses session middleware)
- n8n workflow (16-node passage-branch design from overview spec §5.3)
- `app/lib/act/format.ts` already has the constants; this sub-project just consumes them

**Explicitly deferred:**
- Admin moderation UI for passages and questions — sub-project #6
- User-facing flag-bad-question UI — sub-project #7
- Difficulty-aware generation — the schema's `difficulty` column stays at default 3 for v1 (all AI-generated content is "medium")
- Multi-validity repair (SAT's `findValidChoices` / `repairMultiValid`) — defer; v1 self-verify is a single-pass solve check
- Vercel cron daily 404 → resolved (this sub-project creates `/api/admin/generate-questions`)

**Out of scope entirely:**
- Streaming responses (Ollama Cloud chat completions stays `stream: false`)
- Function calling / structured outputs (zod-on-JSON suffices)
- Multiple AI providers in production (Ollama Cloud only; the interface allows swap-by-env-var)

### Success bar

1. A signed-in user can navigate to `/test/new` (placeholder UI in v1; sub-project #4 builds the real flow) and trigger `draw_test()` server-side. The RPC returns a fully-formed payload conforming to the shape in overview spec §3.11.
2. Vercel cron at midnight UTC produces ≥1 new passage + its questions when buffers are below target.
3. n8n workflow executes hourly and produces output indistinguishable from `runGeneration()`.
4. AI provider can be swapped via `ACT_AI_PROVIDER=ollama-cloud` env var (default and only impl in v1).
5. `supabase advisor get_advisors(type='security')` shows 0 WARN-level lints on the new SQL.

---

## 2. Stack & Conventions

Unchanged from prior sub-projects. Adds:

- **Ollama Cloud** as the AI provider. OpenAI-compatible chat completions API at `${OLLAMA_BASE_URL}/v1/chat/completions`. Model: `deepseek-v3.1:671b-cloud` (set via `OLLAMA_MODEL` env var).
- **Vercel cron** via the daily entry in `vercel.json` (already committed in Foundation). Configurable bearer-token security via `CRON_SECRET` env var (set in Foundation).
- **n8n workflow** authoring via the `mcp__abi-n8n__create_workflow_from_code` MCP tool.

Mirrors SAT structurally; diverges in content (passages, ACT-specific skill taxonomy, no SPR).

---

## 3. File Structure

```
app/lib/ai/
├── provider.ts                  AIProvider interface + getProvider() factory
├── ollama.ts                    OllamaCloudProvider impl
├── schema.ts                    zod schemas: passage candidate, question candidate
├── dedup.ts                     dedupHash() helpers (mirror DB triggers)
├── prompts/
│   ├── english_essay.passage.ts          5 prompts — one per passage type
│   ├── reading_literary_narrative.passage.ts
│   ├── reading_social_science.passage.ts
│   ├── reading_humanities.passage.ts
│   ├── reading_natural_science.passage.ts
│   ├── science_data_representation.passage.ts
│   ├── science_research_summaries.passage.ts
│   ├── science_conflicting_viewpoints.passage.ts
│   ├── english_essay.questions.ts        questions-for-passage prompts (1:1 with passages)
│   ├── reading_literary_narrative.questions.ts
│   ├── reading_social_science.questions.ts
│   ├── reading_humanities.questions.ts
│   ├── reading_natural_science.questions.ts
│   ├── science_data_representation.questions.ts
│   ├── science_research_summaries.questions.ts
│   ├── science_conflicting_viewpoints.questions.ts
│   ├── math_preparing_for_higher_math.ts standalone Math (3 prompts)
│   ├── math_integrating_essential_skills.ts
│   └── math_modeling.ts
└── generate.ts                  runGeneration() — canonical top-up loop

app/api/admin/
└── generate-questions/route.ts  GET handler; secret-gated; calls runGeneration()

supabase/migrations/
├── 20260526020000_act_draw_test.sql          act.draw_test RPC + helper functions
└── 20260526020100_act_service_role_grants.sql   GRANT USAGE on schema to service_role (mirror SAT's foundation gotcha)

scripts/
└── warm-pool.ts                 one-shot script — pnpm dlx tsx scripts/warm-pool.ts
                                 calls runGeneration() N times until buffers are full;
                                 admin runs after first deploy to skip the cold-start gap
```

**Total new files:** ~28. The single biggest file in this sub-project is `generate.ts` (~300 lines, mirrors SAT's pattern).

---

## 4. AI Provider Interface

```ts
// app/lib/ai/provider.ts
import type { PassageType, ActSection } from '@/app/lib/act/format';
import type { PassageCandidate, QuestionCandidate } from './schema';

export interface AIProvider {
  // Generate one passage of the given type. Returns the passage candidate
  // (body + optional stimuli + title), which the caller will insert into
  // act.passages, then call generateQuestionsForPassage() with the new id.
  generatePassage(passageType: PassageType): Promise<PassageCandidate>;

  // Given a freshly-inserted passage, generate exactly PASSAGE_QUESTION_COUNTS[passageType]
  // questions targeting it. Returns the question candidates. The skill mix
  // across the batch should cover all 3 skills for the section (e.g., reading
  // passage's 9 questions should include at least one from each of the 3
  // reading skills).
  generateQuestionsForPassage(input: {
    passageType: PassageType;
    passageBody: string;
    passageStimuli?: Array<{ kind: 'table' | 'figure'; caption: string; data: unknown }>;
  }): Promise<QuestionCandidate[]>;

  // Generate `count` standalone Math questions for the given skill.
  generateMathStandalone(skill: string, count: number): Promise<QuestionCandidate[]>;

  // Re-solve a question for self-verify: return the A/B/C/D answer key the
  // model independently derives. If it disagrees with the candidate's
  // answer_key, the candidate is rejected.
  solveQuestion(input: {
    stem: string;
    choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
    passageBody?: string;
    passageStimuli?: Array<{ kind: 'table' | 'figure'; caption: string; data: unknown }>;
  }): Promise<'A' | 'B' | 'C' | 'D'>;
}

export function getProvider(): AIProvider {
  const name = process.env.ACT_AI_PROVIDER ?? 'ollama-cloud';
  switch (name) {
    case 'ollama-cloud':
      return new OllamaCloudProvider();
    default:
      throw new Error(`Unknown ACT_AI_PROVIDER: ${name}`);
  }
}
```

### Zod schemas (`schema.ts`)

```ts
import { z } from 'zod';
import { PASSAGE_QUESTION_COUNTS } from '@/app/lib/act/format';

export const passageCandidateSchema = z.object({
  passage_type: z.enum([
    'english_essay', 'literary_narrative', 'social_science', 'humanities',
    'natural_science', 'data_representation', 'research_summaries',
    'conflicting_viewpoints',
  ]),
  title: z.string().min(3).max(200),
  body: z.string().min(50).max(8000),
  stimuli: z.array(z.object({
    kind: z.enum(['table', 'figure']),
    caption: z.string(),
    data: z.unknown(), // schema-permissive: tables are 2D arrays, figures are { axes, series }
  })).optional(),
});

export const questionCandidateSchema = z.object({
  section: z.enum(['english', 'math', 'reading', 'science']),
  skill: z.string(), // validated against SKILLS[section] outside zod
  stem: z.string().min(5).max(2000),
  choices: z.array(z.object({
    key: z.enum(['A', 'B', 'C', 'D']),
    text: z.string().min(1).max(500),
  })).length(4),
  answer_key: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(10).max(2000),
  passage_marker: z.number().int().min(1).max(20).optional(), // English only
});

export type PassageCandidate = z.infer<typeof passageCandidateSchema>;
export type QuestionCandidate = z.infer<typeof questionCandidateSchema>;
```

---

## 5. Prompt Templates

19 files under `app/lib/ai/prompts/`. Each exports a single function returning the prompt string for that (passage_type, role) pair.

### 5.1 Passage prompts (8 files)

Each `<passage_type>.passage.ts` exports `buildPassagePrompt(): string`.

**Common structure:**
- Tell the model to produce JSON-only output matching `passageCandidateSchema`
- Specify passage type-specific style guidelines (e.g., Reading "literary_narrative" = excerpt from a novel-like text; Science "data_representation" = methodology + table)
- For English: instruct embedding of `[[N]]` markers at insertion points (10 markers for ACT English passages)
- For Science: instruct including tables/figures in `stimuli` as JSON-serializable structures

**Example excerpt — `reading_natural_science.passage.ts`:**

```ts
export function buildReadingNaturalSciencePassage(): string {
  return `Generate one ACT Reading "Natural Science" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "natural_science",
  "title": "<3-12 words>",
  "body": "<400-600 words of expository prose about a scientific topic — physics, biology, chemistry, earth science, or astronomy. Use a third-person, journalistic tone. Include at least one specific researcher / institution / dated event for realism. Cite no real published papers verbatim.>"
}
The body must be self-contained: questions will reference it without rereading.
The body must NOT use markdown formatting (no asterisks, no headers, no lists).
The body must NOT mention "ACT", "test", "passage", "question", or "choice" — it is an article.`;
}
```

(Similar templates for the other 7 passage types, each tuned to the ACT's documented style for that type.)

### 5.2 Questions-for-passage prompts (8 files)

Each exports `buildQuestionsForPassagePrompt(passageBody, passageStimuli?)`. The prompt:

- Embeds the passage verbatim
- Asks for exactly `PASSAGE_QUESTION_COUNTS[type]` questions
- Specifies the per-section skill mix (must cover all 3 skills for the section)
- Reinforces no-letter-references rule in explanations (mirror SAT's gotcha)
- For English: requires every question to reference a specific `[[N]]` marker via `passage_marker`
- For Science: requires every question to cite at least one row/column/figure label

**Example excerpt — `reading_natural_science.questions.ts`:**

```ts
import { PASSAGE_QUESTION_COUNTS, SKILLS } from '@/app/lib/act/format';

export function buildReadingNaturalScienceQuestionsPrompt(passageBody: string): string {
  const count = PASSAGE_QUESTION_COUNTS.natural_science; // 9
  const skills = SKILLS.reading.join(', '); // key_ideas_and_details, craft_and_structure, integration_of_knowledge
  return `Generate ${count} ACT Reading questions targeting this Natural Science passage.
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

Passage (verbatim — do NOT modify it):
"""
${passageBody}
"""

Each object has exactly these keys:
- "section": must be "reading"
- "skill": one of [${skills}]
- "stem": the question text (50-250 chars)
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences saying why the correct answer is right

Rules:
- Across the ${count} questions, EACH of the 3 reading skills must appear at least once.
- Distractors must be plausible but wrong. Exactly one choice is correct.
- The explanation must NEVER refer to choices by letter ("Choice A...", "Option B...") — refer to the correct option as "the correct choice" or by quoting its text. The app shuffles choices.
- Every question must be answerable from the passage alone (no outside knowledge).
- No two questions ask the same thing in different words.`;
}
```

### 5.3 Standalone Math prompts (3 files)

`math_preparing_for_higher_math.ts`, `math_integrating_essential_skills.ts`, `math_modeling.ts`. Each exports `buildMathPrompt(count: number): string`. Pattern matches SAT's MCQ math prompt with these differences:
- Skill names match ACT taxonomy
- All-choices-A/B/C/D format (no SPR — ACT Math is multiple-choice only in Enhanced ACT)
- No passage; standalone problems only

---

## 6. `runGeneration()` — Canonical Top-up Loop

Lives in `app/lib/ai/generate.ts`. Called by both the Vercel cron and (mirror semantics in JS) the n8n workflow.

**Behavior:**

```ts
export async function runGeneration(opts?: { maxBatches?: number; logRunRow?: boolean }) {
  const maxBatches = opts?.maxBatches ?? 6;
  const supabase = createAdminClient(); // service-role; bypasses RLS
  const provider = getProvider();

  // 1. Read current pool counts: passages by type, math questions by skill.
  const buffers = await readBufferCounts(supabase);
  
  // 2. Plan the thinnest 0..maxBatches buckets, in increasing order of fill ratio.
  const plan = planBatches(buffers, maxBatches);
  if (plan.length === 0) return { generated: 0, reason: 'all buffers above target' };

  let produced = 0;
  const errors: Array<{ bucket: string; message: string }> = [];

  for (const batch of plan) {
    try {
      if (batch.kind === 'passage') {
        // a. Generate passage
        const passage = await provider.generatePassage(batch.passage_type);
        passageCandidateSchema.parse(passage); // throws on shape mismatch
        // b. Insert passage; trigger fills id+dedup_hash
        const { data: inserted, error: insertErr } = await supabase
          .schema('act').from('passages')
          .insert({
            section: sectionForPassageType(batch.passage_type),
            passage_type: batch.passage_type,
            title: passage.title,
            body: passage.body,
            stimuli: passage.stimuli ?? [],
          })
          .select('id')
          .single();
        if (insertErr) {
          // dedup_hash collision is benign — passage already exists with this body
          if (insertErr.code === '23505') continue;
          throw insertErr;
        }
        // c. Generate questions for this passage
        const questions = await provider.generateQuestionsForPassage({
          passageType: batch.passage_type,
          passageBody: passage.body,
          passageStimuli: passage.stimuli,
        });
        // d. Self-verify each question; drop ones the model can't re-solve
        const verified: typeof questions = [];
        for (const q of questions) {
          questionCandidateSchema.parse(q);
          // Skill must be valid for the section
          if (!SKILLS[q.section].includes(q.skill)) continue;
          const reAnswer = await provider.solveQuestion({
            stem: q.stem,
            choices: q.choices,
            passageBody: passage.body,
            passageStimuli: passage.stimuli,
          });
          if (reAnswer === q.answer_key) verified.push(q);
        }
        // e. Insert verified questions
        for (const q of verified) {
          await supabase.schema('act').from('questions').insert({
            section: q.section,
            skill: q.skill,
            difficulty: 3, // v1: default
            passage_id: inserted!.id,
            passage_marker: q.passage_marker ?? null,
            stem: q.stem,
            choices: q.choices,
            answer_key: q.answer_key,
            explanation: q.explanation,
          });
        }
        produced += verified.length;
      } else {
        // batch.kind === 'math_standalone'
        const cand = await provider.generateMathStandalone(batch.skill, 3);
        for (const q of cand) {
          questionCandidateSchema.parse(q);
          if (q.section !== 'math' || !SKILLS.math.includes(q.skill)) continue;
          const reAnswer = await provider.solveQuestion({ stem: q.stem, choices: q.choices });
          if (reAnswer !== q.answer_key) continue;
          await supabase.schema('act').from('questions').insert({
            section: 'math',
            skill: q.skill,
            difficulty: 3,
            passage_id: null,
            passage_marker: null,
            stem: q.stem,
            choices: q.choices,
            answer_key: q.answer_key,
            explanation: q.explanation,
          });
          produced += 1;
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ bucket: bucketLabel(batch), message });
    }
  }

  // Log to act.generation_runs for admin visibility
  if (opts?.logRunRow !== false) {
    await supabase.schema('act').from('generation_runs').insert({
      finished_at: new Date().toISOString(),
      skill: plan[0]?.kind === 'passage' ? plan[0].passage_type : plan[0]?.skill ?? null,
      target: plan.reduce((sum, b) => sum + (b.kind === 'passage' ? PASSAGE_QUESTION_COUNTS[b.passage_type] : 3), 0),
      produced,
      errors,
    });
  }

  return { generated: produced, batches: plan.length, errors };
}
```

**Buffer targets** (per overview spec §5.2):

| Bucket | Target |
|--------|--------|
| English passages (`english_essay`) | 20 |
| Reading passages — each of 4 types | 8 |
| Science passages — `data_representation` | 15 |
| Science passages — `research_summaries` | 15 |
| Science passages — `conflicting_viewpoints` | 8 |
| Math standalone questions — each of 3 skills | 60 |

`planBatches()` picks the thinnest bucket (lowest fill ratio = current/target) first.

---

## 7. Cold-Start Strategy

The overview spec §5.7 calls for an in-code seed BANK fallback. **This sub-project deliberately deviates**: writing 9 passages × 5-10 questions = 60-90 hand-written items (with rich Science stimuli) is multi-hour work and the content quality is dubious vs. AI. Instead:

- `act.draw_test()` does NOT silently pad from a seed BANK. If the pool is too thin to assemble a test, it raises a clear PostgreSQL exception: `'act pool is empty — admin must run /api/admin/warm-pool'`.
- `scripts/warm-pool.ts` is a one-shot CLI: it calls `runGeneration({ maxBatches: 50 })` repeatedly until all buffer targets are met or 10 iterations are exhausted (whichever first).
- After Foundation + sub-project #3 deploys, admin runs `pnpm dlx tsx --env-file=.env.local scripts/warm-pool.ts` once to populate the initial pool (~30-60 min depending on Ollama Cloud latency).
- Subsequent hourly n8n runs keep it warm with no manual intervention.

This is a documented operational step, not a permanent gap. The overview spec is amended accordingly via this design doc; the implementation will not embed a seed BANK.

---

## 8. `act.draw_test()` RPC

Lives in `supabase/migrations/20260526020000_act_draw_test.sql`.

```sql
create or replace function act.draw_test(p_include_science boolean)
returns jsonb
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_attempt_id uuid;
  v_user_id uuid := auth.uid();
  v_payload jsonb;
  v_english_passages jsonb;
  v_reading_passages jsonb;
  v_science_passages jsonb;
  v_questions jsonb;
  v_required_eng int := 5;
  v_required_read int := 4;
  v_required_sci int := 7;
  v_eng_count int;
  v_read_count int;
  v_sci_count int;
begin
  if v_user_id is null then
    raise exception 'act.draw_test requires an authenticated user';
  end if;

  -- Check buffers; raise a friendly exception if pool insufficient.
  select count(*) into v_eng_count from act.passages where section = 'english' and enabled;
  select count(*) into v_read_count from act.passages where section = 'reading' and enabled;
  if p_include_science then
    select count(*) into v_sci_count from act.passages where section = 'science' and enabled;
  else
    v_sci_count := 0;
  end if;

  if v_eng_count < v_required_eng or v_read_count < v_required_read
    or (p_include_science and v_sci_count < v_required_sci) then
    raise exception 'act pool too thin: need >=5 english, >=4 reading%s; have % english, % reading, % science. Run /api/admin/warm-pool.',
      case when p_include_science then ', >=7 science' else '' end,
      v_eng_count, v_read_count, v_sci_count;
  end if;

  -- 1. Pick 5 random enabled English passages with no-repeat-per-user.
  --    English: 5 distinct passages × 10 questions each = 50.
  with previously_used as (
    select distinct q.passage_id
    from act.attempt_responses ar
    join act.questions q on q.id = ar.question_id
    join act.test_attempts a on a.id = ar.attempt_id
    where a.user_id = v_user_id and q.passage_id is not null
  ),
  pool as (
    select p.id, p.section, p.passage_type, p.title, p.body, p.stimuli
    from act.passages p
    where p.enabled and p.section = 'english'
      and p.id not in (select passage_id from previously_used where passage_id is not null)
    order by random() limit v_required_eng
  )
  select jsonb_agg(to_jsonb(p.*)) into v_english_passages from pool p;

  -- Fallback: if no-repeat filter starved the pool, allow repeats.
  if jsonb_array_length(coalesce(v_english_passages, '[]'::jsonb)) < v_required_eng then
    select jsonb_agg(to_jsonb(p.*))
    into v_english_passages
    from (select * from act.passages where enabled and section = 'english'
          order by random() limit v_required_eng) p;
  end if;

  -- 2. Reading: 4 passages, one per passage_type.
  with picked as (
    select distinct on (passage_type) id, section, passage_type, title, body, stimuli
    from act.passages
    where enabled and section = 'reading'
    order by passage_type, random()
  )
  select jsonb_agg(to_jsonb(p.*)) into v_reading_passages from picked p;

  -- 3. Science (optional): the 3+3+1 mix.
  if p_include_science then
    with picked as (
      (select id, section, passage_type, title, body, stimuli from act.passages
       where enabled and section = 'science' and passage_type = 'data_representation'
       order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages
       where enabled and section = 'science' and passage_type = 'research_summaries'
       order by random() limit 3)
      union all
      (select id, section, passage_type, title, body, stimuli from act.passages
       where enabled and section = 'science' and passage_type = 'conflicting_viewpoints'
       order by random() limit 1)
    )
    select jsonb_agg(to_jsonb(p.*)) into v_science_passages from picked p;
  else
    v_science_passages := '[]'::jsonb;
  end if;

  -- 4. Create the attempt row.
  insert into act.test_attempts (user_id, include_science, status, section_state, raw_scores, scaled_scores)
  values (v_user_id, p_include_science, 'in_progress', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
  returning id into v_attempt_id;

  -- 5. Build the questions payload. Stem + choices only; answer_key stripped.
  --    Helper: get all questions for a passage_id, ordered by passage_marker (English) or random (others).
  with all_passages as (
    select (p->>'id')::uuid as id, p->>'section' as section
    from jsonb_array_elements(coalesce(v_english_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid, p->>'section'
    from jsonb_array_elements(coalesce(v_reading_passages, '[]'::jsonb)) p
    union all
    select (p->>'id')::uuid, p->>'section'
    from jsonb_array_elements(coalesce(v_science_passages, '[]'::jsonb)) p
  ),
  passage_questions as (
    select
      q.id as question_id, q.section, q.passage_id, q.passage_marker, q.stem, q.choices
    from act.questions q
    join all_passages ap on ap.id = q.passage_id
    where q.enabled
  ),
  math_questions as (
    select id as question_id, 'math' as section,
           null::uuid as passage_id, null::smallint as passage_marker,
           stem, choices
    from act.questions
    where enabled and section = 'math' and passage_id is null
    order by random() limit 45
  )
  select jsonb_build_object(
    'english', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'passage_marker', passage_marker, 'stem', stem, 'choices', choices
      ))
      from (
        select * from passage_questions where section = 'english'
        order by passage_id, passage_marker
      ) eng
    ), '[]'::jsonb),
    'math', coalesce((select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'stem', stem, 'choices', choices
      )) from math_questions), '[]'::jsonb),
    'reading', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'stem', stem, 'choices', choices
      ))
      from (select * from passage_questions where section = 'reading'
            order by passage_id) r
    ), '[]'::jsonb),
    'science', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'passage_id', passage_id,
        'stem', stem, 'choices', choices
      ))
      from (select * from passage_questions where section = 'science'
            order by passage_id) s
    ), '[]'::jsonb)
  ) into v_questions;

  -- 6. Final payload.
  v_payload := jsonb_build_object(
    'attempt_id', v_attempt_id,
    'include_science', p_include_science,
    'passages', coalesce(v_english_passages, '[]'::jsonb)
                || coalesce(v_reading_passages, '[]'::jsonb)
                || coalesce(v_science_passages, '[]'::jsonb),
    'sections', v_questions
  );

  return v_payload;
end;
$$;

revoke execute on function act.draw_test(boolean) from public;
grant execute on function act.draw_test(boolean) to authenticated;
```

**Service-role grants migration** (mirror SAT's foundation gotcha — `act` schema needs `USAGE` for service_role explicitly):

```sql
-- 20260526020100_act_service_role_grants.sql
grant usage on schema act to service_role;
grant all on all tables in schema act to service_role;
grant all on all sequences in schema act to service_role;
alter default privileges in schema act grant all on tables to service_role;
alter default privileges in schema act grant all on sequences to service_role;
```

(Foundation's migration revoked all privileges by default — service_role's `BYPASSRLS` only handles RLS, not schema-level USAGE.)

---

## 9. Vercel Cron Route

```ts
// app/api/admin/generate-questions/route.ts
import { NextResponse } from 'next/server';
import { runGeneration } from '@/app/lib/ai/generate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runGeneration();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

The route is in `middleware.ts` PUBLIC_PATHS already (added in Auth) — Vercel cron hits it without a session. The bearer-secret check is the only gate.

---

## 10. n8n Workflow

Created via the n8n MCP tool `mcp__abi-n8n__create_workflow_from_code`. Structure per overview spec §5.3:

1. Schedule Trigger (hourly)
2. Config (Code node; holds `SUPABASE_SERVICE_ROLE_KEY` + `OLLAMA_API_KEY` as placeholders for user to paste in UI)
3. Get Counts (HTTP Request; reads `act.passages` and `act.questions` grouped)
4. Plan Batches (Code; picks thinnest bucket; emits up to 6 batches)
5. Switch on `batch.kind`
6. [passage branch] Generate Passage (HTTP, timeout 180s, neverError) → Parse Passage (Code) → Insert Passage (HTTP) → Generate Questions for Passage (HTTP) → Parse Q (Code) → Solve & Verify (HTTP) → Insert Questions (HTTP)
7. [math branch] Generate Math (HTTP) → Parse (Code) → Solve & Verify (HTTP) → Insert Question (HTTP)

The two branches converge at the end into a no-op terminal node. The workflow is created with placeholders for secrets — admin pastes real values via the n8n UI after creation.

**Implementation note:** the n8n workflow is created via MCP at the END of the sub-project (after `runGeneration()` and `act.draw_test` are working). It's a mirror of the canonical TS implementation in code-node JS, not a port — admin verifies it produces the same output shape via a manual test run.

---

## 11. Sub-project Boundaries

**What #4 (Persistence + test runner) gets from #3:**
- `act.draw_test(p_include_science)` RPC returning the assembled payload — sub-project #4 calls this on "Start test" and renders the result.
- The pool is reliably populated (admin has run `warm-pool.ts`).

**What this sub-project explicitly does NOT do:**
- Render any UI to start a test (deferred to #4)
- Score tests (deferred to #4: `submit_section`, `finalize_attempt`)
- Show admin moderation tools (deferred to #6)
- Show a flag-bad-question UI (deferred to #7)

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Science generation produces incoherent stimuli (figures/tables disagree with stems) | Self-verify step solves the question against the passage; if model disagrees with `answer_key`, the question is dropped. Admin (#6) bulk-disables what slips through. |
| Ollama Cloud latency causes Vercel cron timeout (60s hobby plan) | `runGeneration()` is bounded by `maxBatches=6`; each batch is one passage+questions or one math standalone (~25-40s of Ollama calls). Single batch fits in 60s. n8n is the primary keep-warm path (no Vercel timeout). |
| Cold-start: first test fails because pool is empty | `warm-pool.ts` is a documented one-shot. `act.draw_test` raises a clear exception so the UI can surface "Pool warming, try in a few minutes." |
| Service-role key leak (admin client imported into `'use client'`) | CLAUDE.md verification command; lint pattern; this sub-project adds `app/lib/ai/*.ts` to the expected-matches list. |
| Letter-references in explanations break after choice shuffle | Mirror SAT's prompt rule + explicit "explanation must not say 'Choice A'" instruction. v1 does not do post-hoc regex repair (defer). |
| AI generates duplicates of existing pool content | DB trigger computes `dedup_hash` on insert; UNIQUE constraint rejects duplicates. The insert path catches `code === '23505'` and skips silently. |
| English passage_marker not aligned with the actual `[[N]]` count | Prompt requires exactly 10 markers (1..10). Self-verify rejects questions whose `passage_marker` isn't in [1, 10]. |

---

## 13. Open Questions Resolved

| Question | Decision |
|----------|----------|
| Cold-start seed BANK | Skipped. `warm-pool.ts` script + clear `draw_test` exception instead. |
| Difficulty-aware generation | Deferred. v1 ships all-medium content. |
| SPR (student-produced response) | N/A. Enhanced ACT Math is multiple-choice only. |
| Multi-validity repair (`findValidChoices` / `repairMultiValid`) | Deferred. Single-pass self-verify only in v1. |
| AI provider | Ollama Cloud DeepSeek only in v1. Interface is pluggable for future swaps. |
| n8n workflow timing | Built at end of sub-project after `runGeneration()` is verified. |

---

## 14. References

- Overview spec: `2026-05-26-act-app-overview-design.md` (§3.11 draw_test, §5 n8n)
- SAT precedent:
  - `Personal/satpracticereact/sat-app/app/lib/ai/` (provider.ts, ollama.ts, generate.ts, schema.ts, dedup.ts)
  - `Personal/satpracticereact/sat-app/supabase/migrations/20260521040000_sat_service_role_grants.sql`
  - `Personal/satpracticereact/sat-app/app/api/admin/generate-questions/route.ts`
- n8n SDK: via MCP `get_sdk_reference`
