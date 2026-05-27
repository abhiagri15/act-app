# ACT App — Sub-project #3 (AI Question Generation) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Build the AI question + passage generator (Ollama Cloud DeepSeek), the `act.draw_test()` security-definer RPC, the Vercel cron endpoint, the n8n workflow, and a `warm-pool.ts` script for cold-start. Tag the result `post-ai`.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-ai-questions-design.md`

**Reference codebase:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\app\lib\ai\` and `app\api\admin\generate-questions\route.ts`.

**Working directory:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

**Shell:** Bash for git/pnpm/curl; PowerShell for Windows-native ops.

---

## Task 1: AI provider scaffolding

**Files:**
- Create: `app/lib/ai/schema.ts`
- Create: `app/lib/ai/dedup.ts`
- Create: `app/lib/ai/provider.ts`

- [ ] **Step 1: Write `schema.ts`** — zod schemas for `passageCandidateSchema` and `questionCandidateSchema` per spec §4 ("Zod schemas").

- [ ] **Step 2: Write `dedup.ts`** — `dedupHashPassage(section, passage_type, body)` and `dedupHashQuestion(section, skill, stem, choices)` helpers. Use Node `crypto.createHash('sha256')`. Must produce the EXACT same hashes as the DB triggers (`act.passages_fill_defaults`, `act.questions_fill_defaults`).

Verification by hand: given `(section='english', passage_type='english_essay', body='hello')`, the hex digest must equal `digest('english|english_essay|hello'::bytea, 'sha256')` as computed by Postgres pgcrypto.

- [ ] **Step 3: Write `provider.ts`** — `AIProvider` interface (4 methods: `generatePassage`, `generateQuestionsForPassage`, `generateMathStandalone`, `solveQuestion`) + `getProvider()` factory keyed on `ACT_AI_PROVIDER`.

- [ ] **Step 4:** `pnpm type-check` exits 0.

- [ ] **Step 5:** Commit:
```bash
git add app/lib/ai/schema.ts app/lib/ai/dedup.ts app/lib/ai/provider.ts
git commit -m "feat(ai): provider interface + zod schemas + dedup helpers"
```

---

## Task 2: 19 prompt templates

**Files:** 19 new files under `app/lib/ai/prompts/`

The full prompt content for ALL 19 templates is in spec §5. For each prompt:
- Export a single named function returning the prompt string
- Function name: `build<PassageType>Passage`, `build<PassageType>QuestionsPrompt(passageBody, stimuli?)`, `build<Skill>MathPrompt(count)`
- Keep prompts close to SAT's tone — assertive, JSON-only, no markdown fences
- For passage-questions prompts, embed the passage verbatim in triple-quoted block

**Recommended sequence:** write 1 passage prompt + its question-prompt pair, verify the typings compile, then mechanically duplicate the pattern for the other 7 passage types. Then the 3 math standalones.

- [ ] **Step 1: English passages (1 passage + 1 questions prompt = 2 files)**

`prompts/english_essay.passage.ts` + `prompts/english_essay.questions.ts`. The English passage prompt MUST instruct including 10 `[[N]]` markers (one per question slot). The English questions prompt MUST require every question to carry `passage_marker` in [1..10].

- [ ] **Step 2: Reading passages (4 passage + 4 question prompts = 8 files)**

`prompts/reading_{literary_narrative,social_science,humanities,natural_science}.passage.ts` and the matching `.questions.ts` files. Body length: 400-600 words. 9 questions per passage. Skill mix: all 3 reading skills must appear across the 9.

- [ ] **Step 3: Science passages (3 passage + 3 question prompts = 6 files)**

`prompts/science_{data_representation,research_summaries,conflicting_viewpoints}.passage.ts` and matching `.questions.ts`. 

For Science the passage prompt MUST require:
- `data_representation`: 1 table OR 1 figure stimulus, 5 questions per passage
- `research_summaries`: 2-3 experiment descriptions + 1-2 tables, 6 questions
- `conflicting_viewpoints`: 2-4 scientist viewpoints (named "Scientist 1", "Scientist 2", etc.), 0 stimuli, 7 questions

Questions prompts MUST require citing a specific row/column/figure label from the stimulus.

- [ ] **Step 4: Math standalones (3 files)**

`prompts/math_{preparing_for_higher_math,integrating_essential_skills,modeling}.ts`. Each exports `build<Skill>MathPrompt(count: number)` → prompt for `count` MCQ math questions for that skill.

- [ ] **Step 5:** `pnpm type-check` exits 0.

- [ ] **Step 6: Commit**:
```bash
git add app/lib/ai/prompts/
git commit -m "feat(ai): 19 prompt templates (8 passage + 8 questions-for-passage + 3 math)"
```

---

## Task 3: Ollama Cloud provider

**Files:**
- Create: `app/lib/ai/ollama.ts`

- [ ] **Step 1: Write the provider**

`OllamaCloudProvider` implements all 4 methods of `AIProvider`. Mirrors SAT's `ollama.ts` pattern:
- `chat(content)` helper that POSTs to `${OLLAMA_BASE_URL}/v1/chat/completions` with `{ model, messages: [{role:'user', content}], stream:false }`. Throws on non-200.
- `extractJson(text)` helper that strips ``` fences and parses

Method bodies dispatch to the right prompt builder:
- `generatePassage(passageType)` — call the matching `build<PassageType>Passage()`, send to `chat`, `extractJson`, validate against `passageCandidateSchema`.
- `generateQuestionsForPassage({passageType, passageBody, passageStimuli})` — call the matching `build<PassageType>QuestionsPrompt(passageBody, passageStimuli)`, send to chat, parse, validate array of candidates against `questionCandidateSchema`.
- `generateMathStandalone(skill, count)` — call the matching math prompt, parse, validate.
- `solveQuestion({stem, choices, passageBody?, passageStimuli?})` — short prompt asking for ONE of A/B/C/D as the answer.

Use `OLLAMA_MODEL` env var (default `deepseek-v3.1:671b-cloud`) and `OLLAMA_API_KEY` (required).

- [ ] **Step 2:** `pnpm type-check` exits 0.

- [ ] **Step 3: Commit**:
```bash
git add app/lib/ai/ollama.ts
git commit -m "feat(ai): OllamaCloudProvider implementation (passages + questions + solve)"
```

---

## Task 4: `runGeneration()` canonical loop

**Files:**
- Create: `app/lib/ai/generate.ts`

- [ ] **Step 1: Write the function**

Full pseudocode in spec §6 ("`runGeneration()`"). Key concerns:
- Use the admin (service-role) client for all DB ops
- Read buffer counts via 2 SQL queries (passages grouped by section+passage_type, math questions grouped by skill)
- `planBatches(buffers, maxBatches)`: compute fill ratios, sort ascending, take first `maxBatches`
- Passage branch: generate passage → insert (catch 23505 duplicates) → generate questions → self-verify each → insert verified
- Math branch: generate `count=3` standalones → self-verify each → insert verified
- Log to `act.generation_runs` at the end

Skill validation against `SKILLS[section]` happens OUTSIDE zod (zod permits any string for `skill`).

- [ ] **Step 2:** `pnpm type-check` exits 0.

- [ ] **Step 3: Smoke test locally** (REQUIRES local `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`):

```bash
pnpm dlx vercel env pull .env.local
pnpm dlx tsx -e "import('./app/lib/ai/generate.ts').then(m => m.runGeneration({ maxBatches: 1 })).then(r => console.log(JSON.stringify(r, null, 2)))"
```

Expected: returns `{ generated: <some number>, batches: 1, errors: [] }`. Takes 30-90s. Verify in Supabase: `select count(*) from act.passages`, `select count(*) from act.questions` should show new rows.

- [ ] **Step 4: Commit**:
```bash
git add app/lib/ai/generate.ts
git commit -m "feat(ai): runGeneration() canonical top-up loop"
```

---

## Task 5: `act.draw_test()` RPC + service-role grants

**Files:**
- Create: `supabase/migrations/20260526020000_act_draw_test.sql`
- Create: `supabase/migrations/20260526020100_act_service_role_grants.sql`

- [ ] **Step 1: Write the service-role grants migration**

```sql
-- 20260526020100_act_service_role_grants.sql
-- Foundation revoked all schema privileges by default. service_role bypasses
-- RLS but still needs USAGE on the schema and table-level grants to write.
-- This mirrors sat's 20260521040000_sat_service_role_grants.sql.

grant usage on schema act to service_role;
grant all on all tables in schema act to service_role;
grant all on all sequences in schema act to service_role;
alter default privileges in schema act grant all on tables to service_role;
alter default privileges in schema act grant all on sequences to service_role;
```

Apply via `mcp__claude_ai_Supabase__apply_migration` with name `act_service_role_grants`.

- [ ] **Step 2: Write the `draw_test` migration**

Full SQL in spec §8. Key invariants:
- `security definer` with `search_path = act, public, pg_temp`
- Returns `jsonb`
- Sets `user_id := auth.uid()` internally
- Has explicit no-repeat-per-user passage selection with a fallback to allow repeats if filtered pool is too thin
- Raises a clear exception on cold-start (pool too thin)
- Inserts a fresh `act.test_attempts` row before assembling the questions payload
- Returns the payload shape from overview spec §3.11 (top-level `passages` array + per-section `sections` with question payloads stripped of answer_key)

Apply via `mcp__claude_ai_Supabase__apply_migration` with name `act_draw_test`.

- [ ] **Step 3: Verify both migrations applied**

Use Supabase MCP `execute_sql`:
```sql
select n.nspname, p.proname, p.prosecdef as security_definer,
       array_to_string(p.proconfig, ',') as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act' and p.proname = 'draw_test';
```
Expected: 1 row, `security_definer=true`, `config` contains `search_path=act,public,pg_temp`.

- [ ] **Step 4: Commit**:
```bash
git add supabase/migrations/20260526020000_act_draw_test.sql supabase/migrations/20260526020100_act_service_role_grants.sql
git commit -m "feat(ai): act.draw_test RPC + service_role grants"
```

---

## Task 6: Vercel cron endpoint

**Files:**
- Create: `app/api/admin/generate-questions/route.ts`

- [ ] **Step 1: Write the route** per spec §9. Use `Authorization: Bearer ${CRON_SECRET}` check; 401 on failure; call `runGeneration()`; return result JSON.

- [ ] **Step 2:** `pnpm type-check && pnpm build`. Both must succeed.

- [ ] **Step 3:** Commit:
```bash
git add app/api/admin/generate-questions/
git commit -m "feat(ai): Vercel cron endpoint /api/admin/generate-questions"
```

---

## Task 7: `scripts/warm-pool.ts` cold-start tool

**Files:**
- Create: `scripts/warm-pool.ts`

- [ ] **Step 1: Write the script**

```ts
// Cold-start pool warmer. Run after first deploy with:
//   pnpm dlx tsx --env-file=.env.local scripts/warm-pool.ts
//
// Calls runGeneration({ maxBatches: 6 }) in a loop until all buffer targets
// are met or 20 iterations elapse (whichever first). Prints progress.

import { runGeneration } from '../app/lib/ai/generate';
import { createAdminClient } from '../app/lib/supabase/admin';
import { PASSAGE_QUESTION_COUNTS, SKILLS } from '../app/lib/act/format';

const TARGETS = {
  english_essay: 20,
  literary_narrative: 8,
  social_science: 8,
  humanities: 8,
  natural_science: 8,
  data_representation: 15,
  research_summaries: 15,
  conflicting_viewpoints: 8,
};
const MATH_TARGET = 60;

async function isFull() {
  const supabase = createAdminClient();
  const act = supabase.schema('act');
  
  for (const [type, target] of Object.entries(TARGETS)) {
    const { count } = await act.from('passages')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
      .eq('passage_type', type);
    if ((count ?? 0) < target) return false;
  }
  
  for (const skill of SKILLS.math) {
    const { count } = await act.from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
      .eq('section', 'math')
      .eq('skill', skill);
    if ((count ?? 0) < MATH_TARGET) return false;
  }
  
  return true;
}

async function main() {
  for (let i = 1; i <= 20; i++) {
    if (await isFull()) {
      console.log(`Pool is full. Done in ${i - 1} iterations.`);
      return;
    }
    console.log(`Iteration ${i}: pool not full, running generation...`);
    const result = await runGeneration({ maxBatches: 6, logRunRow: true });
    console.log(`  generated=${result.generated}, errors=${result.errors?.length ?? 0}`);
  }
  console.log('Reached 20 iterations; pool may still be partial — check generation_runs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2:** Commit:
```bash
git add scripts/warm-pool.ts
git commit -m "feat(ai): warm-pool.ts cold-start helper"
```

---

## Task 8: Build + deploy + warm the pool

- [ ] **Step 1: Set the AI env vars on Vercel**

The Foundation set 4 env vars (Supabase URL/anon/service, CRON_SECRET). We need 3 more:
- `ACT_AI_PROVIDER=ollama-cloud`
- `OLLAMA_BASE_URL=https://ollama.com`
- `OLLAMA_API_KEY=<value>` — pull from `sat-app` Vercel project (same key works) OR ask user
- `OLLAMA_MODEL=deepseek-v3.1:671b-cloud`

Use the same approach as Foundation: read SAT's `.env.local` to extract `OLLAMA_API_KEY` value, then add via `printf '%s' "$VALUE" | pnpm dlx vercel env add <NAME> production`.

For SAT's `.env.local`:
```bash
SAT_ENV=c:/Users/AbishekPotlapalli/Desktop/Projects/Personal/satpracticereact/sat-app/.env.local
OLLAMA_KEY=$(grep '^OLLAMA_API_KEY=' "$SAT_ENV" | cut -d= -f2- | tr -d '"' | tr -d "'")
printf '%s' "$OLLAMA_KEY" | pnpm dlx vercel env add OLLAMA_API_KEY production
printf '%s' "$OLLAMA_KEY" | pnpm dlx vercel env add OLLAMA_API_KEY development
# (Skip preview env — Vercel CLI 54.x rejects preview --yes)

printf '%s' "ollama-cloud" | pnpm dlx vercel env add ACT_AI_PROVIDER production
printf '%s' "ollama-cloud" | pnpm dlx vercel env add ACT_AI_PROVIDER development
printf '%s' "https://ollama.com" | pnpm dlx vercel env add OLLAMA_BASE_URL production
printf '%s' "https://ollama.com" | pnpm dlx vercel env add OLLAMA_BASE_URL development
printf '%s' "deepseek-v3.1:671b-cloud" | pnpm dlx vercel env add OLLAMA_MODEL production
printf '%s' "deepseek-v3.1:671b-cloud" | pnpm dlx vercel env add OLLAMA_MODEL development
```

Verify: `pnpm dlx vercel env ls 2>&1 | grep -E "OLLAMA|ACT_AI"`. Expected: 8 rows (4 vars × 2 envs).

- [ ] **Step 2: Pull env vars locally for warm-pool**

```bash
pnpm dlx vercel env pull .env.local
```

- [ ] **Step 3: Push + deploy**

```bash
git push
pnpm dlx vercel --prod --yes 2>&1 | tail -10
```

Capture deploy URL.

- [ ] **Step 4: Warm the pool**

```bash
pnpm dlx tsx --env-file=.env.local scripts/warm-pool.ts 2>&1 | tee /tmp/warm-pool.log
```

This will take 30-90 minutes depending on Ollama latency. Run in the background using Bash with `run_in_background: true`. Periodically check the log.

- [ ] **Step 5: Verify pool populated**

After warm-pool finishes, via Supabase MCP `execute_sql`:
```sql
select section, passage_type, count(*) as n
from act.passages
where enabled
group by section, passage_type
order by section, passage_type;
```
Expected: a row per (section, passage_type) hitting or exceeding the targets.

```sql
select section, skill, count(*) as n
from act.questions
where enabled
group by section, skill
order by section, skill;
```
Expected: math skills ≥ 60 each; reading/english/science skills well-populated (organically from the passages).

- [ ] **Step 6: Verify cron endpoint works**

```bash
curl -s -o /tmp/cron-out.json -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '\"' | tr -d \"'\")" \
  https://act-app-ten.vercel.app/api/admin/generate-questions
cat /tmp/cron-out.json
```

Expected: HTTP 200 with `{"generated":<int>,"batches":<int>,"errors":[]}` shape. Since pool should now be near target, response is likely `{ generated: 0, reason: "all buffers above target" }`.

Test the secret-gate by making the call WITHOUT the header:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://act-app-ten.vercel.app/api/admin/generate-questions
```
Expected: HTTP 401.

---

## Task 9: n8n workflow

**Files:** none in git; workflow lives in n8n at `abhishek15.n8n-wsk.com`

- [ ] **Step 1: Read the n8n SDK reference**

```
mcp__abi-n8n__get_sdk_reference
```

- [ ] **Step 2: Search relevant nodes**

```
mcp__abi-n8n__search_nodes with queries=["schedule trigger", "code", "http request", "switch"]
```

- [ ] **Step 3: Get node type definitions**

`mcp__abi-n8n__get_node_types` for each node discovered.

- [ ] **Step 4: Build the workflow code**

Mirror the structure in spec §10:
1. Schedule Trigger (hourly)
2. Config (Code node — placeholder env vars: `SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_API_KEY` as empty strings; admin pastes via UI)
3. Get Counts (HTTP — POST to Supabase REST `/rest/v1/rpc/...` or direct table queries with header `apikey: {{Config.json.SUPABASE_SERVICE_ROLE_KEY}}`)
4. Plan Batches (Code — replicate the planBatches() logic from generate.ts, simplified to TypeScript-in-Code)
5. Switch (on `batch.kind`)
6. Passage branch: 7 nodes (Ollama HTTP for passage gen, Code parse, HTTP insert passage to act.passages, Ollama HTTP for questions-for-passage, Code parse + skill validation, Ollama HTTP for solve, HTTP insert questions)
7. Math branch: 4 nodes (Ollama HTTP gen, Code parse, Ollama HTTP solve, HTTP insert)

Use HTTP Request nodes for all Ollama calls (`options.timeout: 180000`, `batching.batch.batchSize: 1`, `neverError: true`).

- [ ] **Step 5: Validate the workflow code**

```
mcp__abi-n8n__validate_workflow with the full code
```

Fix any errors and re-validate until clean.

- [ ] **Step 6: Create the workflow**

```
mcp__abi-n8n__create_workflow_from_code with description="ACT question generator. Hourly top-up of act.passages and act.questions via Ollama Cloud. Mirrors runGeneration() in app/lib/ai/generate.ts. Replace the placeholder values in the Config code node with real secrets via the n8n UI before activating."
```

Capture the workflow ID for reference.

- [ ] **Step 7: Test the workflow**

```
mcp__abi-n8n__test_workflow with the workflow ID
```

Verify it runs end-to-end and inserts new rows (check via Supabase `execute_sql`).

If the test fails because the Config secrets aren't filled in (expected — the code has placeholders), TELL THE USER to paste the real values into the Config node via n8n UI: 
- `SUPABASE_SERVICE_ROLE_KEY` (from Vercel)
- `OLLAMA_API_KEY` (from Vercel)
- `SUPABASE_URL=https://falgykkspbtrwdcchayi.supabase.co`
- `OLLAMA_BASE_URL=https://ollama.com`
- `OLLAMA_MODEL=deepseek-v3.1:671b-cloud`

Then re-test.

---

## Task 10: Update CLAUDE.md + final verification + tag

- [ ] **Step 1: Update CLAUDE.md**

Add to the existing CLAUDE.md:
- Document `app/lib/ai/` module structure
- Document the `warm-pool.ts` workflow for cold-start
- Note the n8n workflow ID + placeholder-secret pattern
- Add `app/lib/ai/*.ts` to the admin-client leak guard expected matches
- Remove the resolved "Vercel cron will 404" followup (`/api/admin/generate-questions` now exists)

- [ ] **Step 2: Final verification**

```bash
pnpm type-check  # exit 0
pnpm build       # success
pnpm dlx tsx scripts/check-format.ts  # all OK
```

Smoke test the deploy:
```bash
curl -s -o /dev/null -w "/api/admin/generate-questions (no secret) => %{http_code}\n" https://act-app-ten.vercel.app/api/admin/generate-questions
```
Expected: HTTP 401.

Pool state check via Supabase MCP `execute_sql`:
```sql
select sum(case when section='english' then 1 else 0 end) as english,
       sum(case when section='reading' then 1 else 0 end) as reading,
       sum(case when section='science' then 1 else 0 end) as science
from act.passages where enabled;
```

- [ ] **Step 3: Tag**

```bash
git add CLAUDE.md
git commit -m "docs(ai): document app/lib/ai/ module + warm-pool workflow"
git push
git tag post-ai
git push --tags
```

---

## Done When

- [ ] `app/lib/ai/` has provider, ollama impl, 19 prompts, schema, dedup, generate
- [ ] `act.draw_test()` RPC exists with `SECURITY DEFINER` + locked `search_path`
- [ ] `service_role` has full grants on `act` schema (mirror SAT)
- [ ] `/api/admin/generate-questions` returns 401 without bearer, 200 with valid bearer
- [ ] `pnpm dlx tsx --env-file=.env.local scripts/warm-pool.ts` populated the pool successfully
- [ ] All pool buffers ≥ target (per spec §5.2)
- [ ] n8n workflow created, validated, test-run succeeded (after admin pasted real secrets)
- [ ] CLAUDE.md updated
- [ ] `pnpm type-check`, `pnpm build`, `check-format.ts` all pass
- [ ] Tag `post-ai` pushed
