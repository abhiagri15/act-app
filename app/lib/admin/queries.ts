import { createAdminClient } from '@/app/lib/supabase/admin';
import type { ActSection, PassageType } from '@/app/lib/act/format';

// One row in the admin questions list / detail.
export interface AdminQuestion {
  id: string;
  section: ActSection;
  skill: string;
  difficulty: number;
  passage_id: string | null;
  passage_marker: number | null;
  stem: string;
  choices: unknown;
  answer_key: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  enabled: boolean;
  created_at: string;
}

// One row in the admin passages list / detail.
export interface AdminPassage {
  id: string;
  section: ActSection;
  passage_type: PassageType;
  title: string | null;
  body: string;
  stimuli: unknown;
  enabled: boolean;
  created_at: string;
}

export interface PoolCounts {
  questions_total: number;
  questions_enabled: number;
  questions_disabled: number;
  questions_english: number;
  questions_math: number;
  questions_reading: number;
  questions_science: number;
  passages_total: number;
  passages_enabled: number;
  passages_disabled: number;
}

export interface AdminGenerationRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  skill: string | null;
  target: number | null;
  produced: number;
  errors: unknown;
}

export interface QuestionFilters {
  section?: ActSection;
  skill?: string;
  status?: 'enabled' | 'disabled' | 'all';
}

export interface PassageFilters {
  section?: 'english' | 'reading' | 'science';
  passage_type?: PassageType;
  status?: 'enabled' | 'disabled' | 'all';
}

const QUESTION_COLUMNS =
  'id, section, skill, difficulty, passage_id, passage_marker, stem, choices, answer_key, explanation, enabled, created_at';

const PASSAGE_COLUMNS =
  'id, section, passage_type, title, body, stimuli, enabled, created_at';

// The question pool, newest first, filtered, capped at 200 rows.
// Uses the service-role client because act.questions's RLS policy is
// `using (enabled)` — authenticated callers cannot read disabled questions,
// and admins need to see (and re-enable) those. Behind requireAdmin().
export async function listQuestions(
  filters: QuestionFilters,
): Promise<AdminQuestion[]> {
  const admin = createAdminClient();
  let query = admin.schema('act').from('questions').select(QUESTION_COLUMNS);
  if (filters.section) query = query.eq('section', filters.section);
  if (filters.skill) query = query.eq('skill', filters.skill);
  if (filters.status === 'enabled') query = query.eq('enabled', true);
  else if (filters.status === 'disabled') query = query.eq('enabled', false);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[listQuestions] failed:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminQuestion[];
}

export async function getQuestion(id: string): Promise<AdminQuestion | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('questions')
    .select(QUESTION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getQuestion] failed:', error);
    return null;
  }
  return (data ?? null) as unknown as AdminQuestion | null;
}

export async function listPassages(
  filters: PassageFilters,
): Promise<AdminPassage[]> {
  const admin = createAdminClient();
  let query = admin.schema('act').from('passages').select(PASSAGE_COLUMNS);
  if (filters.section) query = query.eq('section', filters.section);
  if (filters.passage_type) query = query.eq('passage_type', filters.passage_type);
  if (filters.status === 'enabled') query = query.eq('enabled', true);
  else if (filters.status === 'disabled') query = query.eq('enabled', false);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[listPassages] failed:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminPassage[];
}

export async function getPassage(id: string): Promise<AdminPassage | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('passages')
    .select(PASSAGE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getPassage] failed:', error);
    return null;
  }
  return (data ?? null) as unknown as AdminPassage | null;
}

// Returns the child questions of a single passage (used by the passage
// detail view to show the cascade-hide impact of toggling enabled).
export async function getPassageQuestions(
  passageId: string,
): Promise<AdminQuestion[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('questions')
    .select(QUESTION_COLUMNS)
    .eq('passage_id', passageId)
    .order('passage_marker', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[getPassageQuestions] failed:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminQuestion[];
}

// Pool-wide counts for the /admin overview. The pool is small — count in JS.
export async function getPoolCounts(): Promise<PoolCounts> {
  const admin = createAdminClient();
  const [qRes, pRes] = await Promise.all([
    admin.schema('act').from('questions').select('section, enabled'),
    admin.schema('act').from('passages').select('enabled'),
  ]);
  if (qRes.error || pRes.error) {
    console.error('[getPoolCounts] failed:', qRes.error ?? pRes.error);
    return {
      questions_total: 0,
      questions_enabled: 0,
      questions_disabled: 0,
      questions_english: 0,
      questions_math: 0,
      questions_reading: 0,
      questions_science: 0,
      passages_total: 0,
      passages_enabled: 0,
      passages_disabled: 0,
    };
  }
  const qRows = (qRes.data ?? []) as { section: string; enabled: boolean }[];
  const pRows = (pRes.data ?? []) as { enabled: boolean }[];
  return {
    questions_total: qRows.length,
    questions_enabled: qRows.filter((r) => r.enabled).length,
    questions_disabled: qRows.filter((r) => !r.enabled).length,
    questions_english: qRows.filter((r) => r.section === 'english').length,
    questions_math: qRows.filter((r) => r.section === 'math').length,
    questions_reading: qRows.filter((r) => r.section === 'reading').length,
    questions_science: qRows.filter((r) => r.section === 'science').length,
    passages_total: pRows.length,
    passages_enabled: pRows.filter((r) => r.enabled).length,
    passages_disabled: pRows.filter((r) => !r.enabled).length,
  };
}

// Last N generation_runs rows for the /admin/generation log.
export async function listGenerationRuns(
  limit = 50,
): Promise<AdminGenerationRun[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('generation_runs')
    .select('id, started_at, finished_at, skill, target, produced, errors')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[listGenerationRuns] failed:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminGenerationRun[];
}
