import { getProvider } from './provider';
import {
  passageCandidateSchema,
  questionCandidateSchema,
  type PassageCandidate,
  type QuestionCandidate,
} from './schema';
import {
  PASSAGE_QUESTION_COUNTS,
  SKILLS,
  type PassageType,
  type ActSection,
} from '@/app/lib/act/format';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { verbalToNumeric, type Difficulty } from './prompts/_difficulty';

// Targets per spec §6. Generation picks the bucket with the lowest fill ratio
// (count / target) first; the planner returns up to maxBatches buckets.
const PASSAGE_TARGETS: Record<PassageType, number> = {
  english_essay: 20,
  literary_narrative: 8,
  social_science: 8,
  humanities: 8,
  natural_science: 8,
  data_representation: 15,
  research_summaries: 15,
  conflicting_viewpoints: 8,
};

// Per-skill math targets split across difficulty. Total per skill = 60 (same
// as the previous flat MATH_TARGET); the planner now targets the thinnest
// (skill, difficulty) cell rather than the thinnest skill.
const MATH_TARGETS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 20,
  medium: 25,
  hard: 15,
};
const MATH_BATCH_SIZE = 3;

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;

function randomDifficulty(): Difficulty {
  return DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
}

type Batch =
  | {
      kind: 'passage';
      passage_type: PassageType;
      difficulty: Difficulty;
      fillRatio: number;
    }
  | {
      kind: 'math_standalone';
      skill: string;
      difficulty: Difficulty;
      fillRatio: number;
    };

interface BufferCounts {
  // Passages count is per passage_type (not bucketed by difficulty — passages
  // get difficulty assigned uniformly random at plan time).
  passages: Partial<Record<PassageType, number>>;
  // Math is per (skill, difficulty) cell. 3 cells per skill × 3 skills = 9 cells.
  math: Partial<Record<string, Partial<Record<Difficulty, number>>>>;
}

interface RunError {
  bucket: string;
  message: string;
  // Multi-validity gate fields. Set when kind='multi_valid' — a candidate
  // passed the single-answer self-verify but findValidChoices judged more
  // than one choice to be a valid correct answer (or the array didn't
  // include the candidate's claimed answer_key).
  kind?: 'multi_valid';
  question_index?: number;
  valid_indices?: number[];
  answer_key?: 'A' | 'B' | 'C' | 'D';
}

interface RunResult {
  generated: number;
  batches?: number;
  reason?: string;
  errors: RunError[];
}

function sectionForPassageType(p: PassageType): ActSection {
  if (p === 'english_essay') return 'english';
  if (
    p === 'literary_narrative' ||
    p === 'social_science' ||
    p === 'humanities' ||
    p === 'natural_science'
  )
    return 'reading';
  return 'science';
}

function numericToVerbal(n: number | null | undefined): Difficulty | null {
  if (n === 2) return 'easy';
  if (n === 3) return 'medium';
  if (n === 4) return 'hard';
  return null;
}

async function readBufferCounts(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<BufferCounts> {
  const out: BufferCounts = { passages: {}, math: {} };

  // Passages grouped by passage_type, enabled-only.
  const { data: passageRows, error: passageErr } = await supabase
    .schema('act')
    .from('passages')
    .select('passage_type')
    .eq('enabled', true);
  if (passageErr) throw passageErr;
  for (const row of passageRows ?? []) {
    const t = (row as { passage_type: PassageType }).passage_type;
    out.passages[t] = (out.passages[t] ?? 0) + 1;
  }

  // Math standalone questions grouped by (skill, difficulty), enabled-only.
  // Difficulty is the smallint column on act.questions; values 2/3/4 map to
  // easy/medium/hard. Rows with other values (1, 5, or NULL) are ignored
  // for the per-(skill, difficulty) cell counts — they don't block targeting.
  const { data: mathRows, error: mathErr } = await supabase
    .schema('act')
    .from('questions')
    .select('skill, difficulty')
    .eq('enabled', true)
    .eq('section', 'math')
    .is('passage_id', null);
  if (mathErr) throw mathErr;
  for (const row of mathRows ?? []) {
    const r = row as { skill: string; difficulty: number | null };
    const verbal = numericToVerbal(r.difficulty);
    if (!verbal) continue;
    const skillBucket = (out.math[r.skill] ??= {});
    skillBucket[verbal] = (skillBucket[verbal] ?? 0) + 1;
  }
  return out;
}

function planBatches(buffers: BufferCounts, maxBatches: number): Batch[] {
  const batches: Batch[] = [];

  // Passages: one candidate per passage_type. Difficulty picked uniformly
  // random per batch; there's no per-difficulty quota on passage buckets.
  for (const [pt, target] of Object.entries(PASSAGE_TARGETS) as Array<
    [PassageType, number]
  >) {
    const have = buffers.passages[pt] ?? 0;
    if (have < target) {
      batches.push({
        kind: 'passage',
        passage_type: pt,
        difficulty: randomDifficulty(),
        fillRatio: have / target,
      });
    }
  }

  // Math: one candidate per (skill, difficulty) cell — 3 cells per skill × 3
  // skills = 9 cells. Pick the thinnest cells across the whole math grid.
  for (const skill of SKILLS.math) {
    for (const difficulty of DIFFICULTIES) {
      const target = MATH_TARGETS_BY_DIFFICULTY[difficulty];
      const have = buffers.math[skill]?.[difficulty] ?? 0;
      if (have < target) {
        batches.push({
          kind: 'math_standalone',
          skill,
          difficulty,
          fillRatio: have / target,
        });
      }
    }
  }

  batches.sort((a, b) => a.fillRatio - b.fillRatio);
  return batches.slice(0, maxBatches);
}

function bucketLabel(b: Batch): string {
  return b.kind === 'passage'
    ? `passage:${b.passage_type}:${b.difficulty}`
    : `math:${b.skill}:${b.difficulty}`;
}

export async function runGeneration(opts?: {
  maxBatches?: number;
  logRunRow?: boolean;
}): Promise<RunResult> {
  const maxBatches = opts?.maxBatches ?? 6;
  const supabase = createAdminClient();
  const provider = getProvider();
  const runStartedAt = new Date().toISOString();

  const buffers = await readBufferCounts(supabase);
  const plan = planBatches(buffers, maxBatches);
  if (plan.length === 0) {
    return { generated: 0, batches: 0, reason: 'all buffers above target', errors: [] };
  }

  let produced = 0;
  const errors: RunError[] = [];

  for (const batch of plan) {
    const bucket = bucketLabel(batch);
    try {
      if (batch.kind === 'passage') {
        produced += await processPassageBatch(
          supabase,
          provider,
          batch.passage_type,
          batch.difficulty,
          bucket,
          errors,
        );
      } else {
        produced += await processMathBatch(
          supabase,
          provider,
          batch.skill,
          batch.difficulty,
          bucket,
          errors,
        );
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null
            ? JSON.stringify(e)
            : String(e);
      console.error('[generate] batch error', bucket, message, e);
      errors.push({ bucket, message });
    }
  }

  if (opts?.logRunRow !== false) {
    try {
      const target = plan.reduce(
        (sum, b) =>
          sum +
          (b.kind === 'passage'
            ? PASSAGE_QUESTION_COUNTS[b.passage_type]
            : MATH_BATCH_SIZE),
        0,
      );
      const head = plan[0];
      const skill =
        head?.kind === 'passage'
          ? head.passage_type
          : head?.kind === 'math_standalone'
            ? head.skill
            : null;
      await supabase.schema('act').from('generation_runs').insert({
        started_at: runStartedAt,
        finished_at: new Date().toISOString(),
        skill,
        target,
        produced,
        errors,
      });
    } catch (e) {
      console.error('[generate] failed to log generation_runs row', e);
    }
  }

  return { generated: produced, batches: plan.length, errors };
}

function answerKeyToIndex(key: 'A' | 'B' | 'C' | 'D'): number {
  return key.charCodeAt(0) - 'A'.charCodeAt(0);
}

// Belt-and-suspenders pass: the ACT prompt explicitly tells the model not to
// refer to choices by letter ("Choice A is correct...") in explanations. Most
// of the time it complies, but it occasionally slips. The app shuffles choice
// keys at runtime, so a surviving "Choice A" reference becomes wrong the moment
// the question is served. This regex rewrites any surviving "Choice X" /
// "Option N" references to either "the correct choice" or "another choice"
// based on whether the referenced index matches the candidate's intended
// answer. Mirrors SAT's n8n Parse-Candidates pattern.
//
// Matches (case-insensitive): \b(Choice|Option)\s+([A-D]|[0-3])\b
//   "Choice A" / "choice b" / "OPTION C" / "Option 2" / etc.
// "Choice X" letter form: A=0, B=1, C=2, D=3.
// "Option N" digit form: 0..3 already 0-based.
// Runs multiple passes until stable (in case a replacement produces a residual
// pattern, which it shouldn't, but the stability check is cheap insurance).
export function repairLetterRefs(
  explanation: string,
  correctIndex: number,
  _choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>,
): string {
  const pattern = /\b(Choice|Option)\s+([A-Da-d]|[0-3])\b/gi;
  let current = explanation;
  // Cap at 5 passes — replacements never grow the string in a way the regex
  // could re-match, but the cap guarantees the loop terminates regardless.
  for (let pass = 0; pass < 5; pass++) {
    let mutated = false;
    const next = current.replace(pattern, (_match, _kind, token) => {
      mutated = true;
      let refIndex: number;
      const t = String(token);
      if (/^[A-Da-d]$/.test(t)) {
        refIndex = t.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
      } else {
        refIndex = Number.parseInt(t, 10);
      }
      return refIndex === correctIndex ? 'the correct choice' : 'another choice';
    });
    if (!mutated || next === current) {
      current = next;
      break;
    }
    current = next;
  }
  return current;
}

async function processPassageBatch(
  supabase: ReturnType<typeof createAdminClient>,
  provider: ReturnType<typeof getProvider>,
  passageType: PassageType,
  difficulty: Difficulty,
  bucket: string,
  errors: RunError[],
): Promise<number> {
  // a. Generate passage.
  const candidate = await provider.generatePassage(passageType, difficulty);
  const parsedPassage = passageCandidateSchema.safeParse(candidate);
  if (!parsedPassage.success) {
    throw new Error(
      `passage schema reject: ${parsedPassage.error.issues[0]?.message ?? 'unknown'}`,
    );
  }
  const passage: PassageCandidate = parsedPassage.data;
  // Pin passage_type to what we requested (defensive — prompt also asks for it).
  if (passage.passage_type !== passageType) {
    throw new Error(
      `passage_type mismatch: asked ${passageType}, got ${passage.passage_type}`,
    );
  }

  // b. Insert passage; trigger fills dedup_hash. UNIQUE collision (23505) means
  //    a passage with this exact body already exists — benign, skip.
  const { data: inserted, error: insertErr } = await supabase
    .schema('act')
    .from('passages')
    .insert({
      section: sectionForPassageType(passageType),
      passage_type: passageType,
      title: passage.title,
      body: passage.body,
      stimuli: passage.stimuli ?? [],
    })
    .select('id')
    .single();
  if (insertErr) {
    if (insertErr.code === '23505') return 0;
    throw new Error(
      `passage insert (${passageType}): ${insertErr.code ?? '?'} ${insertErr.message ?? ''} ${insertErr.details ?? ''} ${insertErr.hint ?? ''}`.trim(),
    );
  }
  const passageId = (inserted as { id: string }).id;

  // c. Generate questions for this passage.
  const rawQuestions = await provider.generateQuestionsForPassage({
    passageType,
    passageBody: passage.body,
    passageStimuli: passage.stimuli,
    difficulty,
  });

  // d. Validate + self-verify each question; drop ones the model can't re-solve.
  //    Then run the multi-validity gate (findValidChoices) on the survivors;
  //    drop any candidate whose choice list has > 1 valid answer (or whose
  //    intended answer_key isn't among the valid indices).
  const verified: QuestionCandidate[] = [];
  for (let qi = 0; qi < rawQuestions.length; qi++) {
    const q = rawQuestions[qi];
    const parsedQ = questionCandidateSchema.safeParse(q);
    if (!parsedQ.success) continue;
    const candidateQ = parsedQ.data;
    const expectedSection = sectionForPassageType(passageType);
    if (candidateQ.section !== expectedSection) continue;
    const validSkills = SKILLS[candidateQ.section];
    if (!validSkills.includes(candidateQ.skill)) continue;
    // English questions MUST have passage_marker in 1..10; others MUST NOT.
    if (expectedSection === 'english') {
      if (
        candidateQ.passage_marker === undefined ||
        candidateQ.passage_marker < 1 ||
        candidateQ.passage_marker > 10
      ) {
        continue;
      }
    }

    let reAnswer: 'A' | 'B' | 'C' | 'D';
    try {
      reAnswer = await provider.solveQuestion({
        stem: candidateQ.stem,
        choices: candidateQ.choices,
        passageBody: passage.body,
        passageStimuli: passage.stimuli,
      });
    } catch (e) {
      console.error('[generate] solve error', e);
      continue;
    }
    if (reAnswer !== candidateQ.answer_key) continue;

    // Multi-validity gate. Mirrors SAT's findValidChoices pattern.
    let validIndices: number[];
    try {
      validIndices = await provider.findValidChoices({
        stem: candidateQ.stem,
        choices: candidateQ.choices,
        passageBody: passage.body,
        passageStimuli: passage.stimuli,
      });
    } catch (e) {
      console.error('[generate] findValidChoices error', e);
      continue;
    }
    const intendedIndex = answerKeyToIndex(candidateQ.answer_key);
    const okSingle =
      validIndices.length === 1 && validIndices[0] === intendedIndex;
    if (!okSingle) {
      errors.push({
        bucket,
        message: `multi_valid: indices=[${validIndices.join(',')}] answer_key=${candidateQ.answer_key}`,
        kind: 'multi_valid',
        question_index: qi,
        valid_indices: validIndices,
        answer_key: candidateQ.answer_key,
      });
      continue;
    }
    verified.push(candidateQ);
  }

  // e. Insert verified questions. Run repairLetterRefs() on each explanation
  //    immediately before insert to scrub any surviving "Choice A" / "Option B"
  //    references — belt-and-suspenders for the prompt-level instruction.
  const numericDifficulty = verbalToNumeric(difficulty);
  let inserts = 0;
  for (const q of verified) {
    const cleanedExplanation = repairLetterRefs(
      q.explanation,
      answerKeyToIndex(q.answer_key),
      q.choices,
    );
    const { error } = await supabase
      .schema('act')
      .from('questions')
      .insert({
        section: q.section,
        skill: q.skill,
        difficulty: numericDifficulty,
        passage_id: passageId,
        passage_marker: q.passage_marker ?? null,
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: cleanedExplanation,
      });
    if (error) {
      if (error.code !== '23505') {
        console.error('[generate] question insert error', error);
      }
      continue;
    }
    inserts++;
  }
  return inserts;
}

async function processMathBatch(
  supabase: ReturnType<typeof createAdminClient>,
  provider: ReturnType<typeof getProvider>,
  skill: string,
  difficulty: Difficulty,
  bucket: string,
  errors: RunError[],
): Promise<number> {
  const rawQuestions = await provider.generateMathStandalone(
    skill,
    MATH_BATCH_SIZE,
    difficulty,
  );
  const numericDifficulty = verbalToNumeric(difficulty);
  let inserts = 0;
  for (let qi = 0; qi < rawQuestions.length; qi++) {
    const q = rawQuestions[qi];
    const parsedQ = questionCandidateSchema.safeParse(q);
    if (!parsedQ.success) continue;
    const candidateQ = parsedQ.data;
    if (candidateQ.section !== 'math') continue;
    if (!SKILLS.math.includes(candidateQ.skill)) continue;
    if (candidateQ.skill !== skill) continue;
    if (candidateQ.passage_marker !== undefined) continue;

    let reAnswer: 'A' | 'B' | 'C' | 'D';
    try {
      reAnswer = await provider.solveQuestion({
        stem: candidateQ.stem,
        choices: candidateQ.choices,
      });
    } catch (e) {
      console.error('[generate] solve error', e);
      continue;
    }
    if (reAnswer !== candidateQ.answer_key) continue;

    // Multi-validity gate. Reject Math candidates where >1 choice is judged
    // valid (e.g. a quadratic with both roots in the choice list) or where
    // the claimed answer_key isn't among the valid indices.
    let validIndices: number[];
    try {
      validIndices = await provider.findValidChoices({
        stem: candidateQ.stem,
        choices: candidateQ.choices,
      });
    } catch (e) {
      console.error('[generate] findValidChoices error', e);
      continue;
    }
    const intendedIndex = answerKeyToIndex(candidateQ.answer_key);
    const okSingle =
      validIndices.length === 1 && validIndices[0] === intendedIndex;
    if (!okSingle) {
      errors.push({
        bucket,
        message: `multi_valid: indices=[${validIndices.join(',')}] answer_key=${candidateQ.answer_key}`,
        kind: 'multi_valid',
        question_index: qi,
        valid_indices: validIndices,
        answer_key: candidateQ.answer_key,
      });
      continue;
    }

    // Scrub any "Choice A" / "Option B" residuals before insert.
    const cleanedExplanation = repairLetterRefs(
      candidateQ.explanation,
      intendedIndex,
      candidateQ.choices,
    );
    const { error } = await supabase
      .schema('act')
      .from('questions')
      .insert({
        section: 'math',
        skill: candidateQ.skill,
        difficulty: numericDifficulty,
        passage_id: null,
        passage_marker: null,
        stem: candidateQ.stem,
        choices: candidateQ.choices,
        answer_key: candidateQ.answer_key,
        explanation: cleanedExplanation,
      });
    if (error) {
      if (error.code !== '23505') {
        console.error('[generate] math insert error', error);
      }
      continue;
    }
    inserts++;
  }
  return inserts;
}
