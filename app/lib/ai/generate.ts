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
const MATH_TARGET = 60;
const MATH_BATCH_SIZE = 3;

type Batch =
  | { kind: 'passage'; passage_type: PassageType; fillRatio: number }
  | { kind: 'math_standalone'; skill: string; fillRatio: number };

interface BufferCounts {
  passages: Partial<Record<PassageType, number>>;
  math: Partial<Record<string, number>>;
}

interface RunError {
  bucket: string;
  message: string;
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

  // Math standalone questions grouped by skill, enabled-only.
  const { data: mathRows, error: mathErr } = await supabase
    .schema('act')
    .from('questions')
    .select('skill')
    .eq('enabled', true)
    .eq('section', 'math')
    .is('passage_id', null);
  if (mathErr) throw mathErr;
  for (const row of mathRows ?? []) {
    const s = (row as { skill: string }).skill;
    out.math[s] = (out.math[s] ?? 0) + 1;
  }
  return out;
}

function planBatches(buffers: BufferCounts, maxBatches: number): Batch[] {
  const batches: Batch[] = [];

  for (const [pt, target] of Object.entries(PASSAGE_TARGETS) as Array<
    [PassageType, number]
  >) {
    const have = buffers.passages[pt] ?? 0;
    if (have < target) {
      batches.push({
        kind: 'passage',
        passage_type: pt,
        fillRatio: have / target,
      });
    }
  }

  for (const skill of SKILLS.math) {
    const have = buffers.math[skill] ?? 0;
    if (have < MATH_TARGET) {
      batches.push({
        kind: 'math_standalone',
        skill,
        fillRatio: have / MATH_TARGET,
      });
    }
  }

  batches.sort((a, b) => a.fillRatio - b.fillRatio);
  return batches.slice(0, maxBatches);
}

function bucketLabel(b: Batch): string {
  return b.kind === 'passage' ? `passage:${b.passage_type}` : `math:${b.skill}`;
}

export async function runGeneration(opts?: {
  maxBatches?: number;
  logRunRow?: boolean;
}): Promise<RunResult> {
  const maxBatches = opts?.maxBatches ?? 6;
  const supabase = createAdminClient();
  const provider = getProvider();

  const buffers = await readBufferCounts(supabase);
  const plan = planBatches(buffers, maxBatches);
  if (plan.length === 0) {
    return { generated: 0, batches: 0, reason: 'all buffers above target', errors: [] };
  }

  let produced = 0;
  const errors: RunError[] = [];

  for (const batch of plan) {
    try {
      if (batch.kind === 'passage') {
        produced += await processPassageBatch(supabase, provider, batch.passage_type);
      } else {
        produced += await processMathBatch(supabase, provider, batch.skill);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null
            ? JSON.stringify(e)
            : String(e);
      console.error('[generate] batch error', bucketLabel(batch), message, e);
      errors.push({ bucket: bucketLabel(batch), message });
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

async function processPassageBatch(
  supabase: ReturnType<typeof createAdminClient>,
  provider: ReturnType<typeof getProvider>,
  passageType: PassageType,
): Promise<number> {
  // a. Generate passage.
  const candidate = await provider.generatePassage(passageType);
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
  });

  // d. Validate + self-verify each question; drop ones the model can't re-solve.
  const verified: QuestionCandidate[] = [];
  for (const q of rawQuestions) {
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
    if (reAnswer === candidateQ.answer_key) verified.push(candidateQ);
  }

  // e. Insert verified questions.
  let inserts = 0;
  for (const q of verified) {
    const { error } = await supabase
      .schema('act')
      .from('questions')
      .insert({
        section: q.section,
        skill: q.skill,
        difficulty: 3,
        passage_id: passageId,
        passage_marker: q.passage_marker ?? null,
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
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
): Promise<number> {
  const rawQuestions = await provider.generateMathStandalone(skill, MATH_BATCH_SIZE);
  let inserts = 0;
  for (const q of rawQuestions) {
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

    const { error } = await supabase
      .schema('act')
      .from('questions')
      .insert({
        section: 'math',
        skill: candidateQ.skill,
        difficulty: 3,
        passage_id: null,
        passage_marker: null,
        stem: candidateQ.stem,
        choices: candidateQ.choices,
        answer_key: candidateQ.answer_key,
        explanation: candidateQ.explanation,
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
