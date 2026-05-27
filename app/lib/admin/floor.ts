import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  PASSAGE_QUESTION_COUNTS,
  SKILLS,
  type PassageType,
} from '@/app/lib/act/format';

// One cell in the floor-status grid. A cell is either a passage_type (the
// passage-floor gate watches "have I generated >= floor passages of this
// type yet?") or a math (skill, difficulty) pair (the skill-floor gate
// watches "have I generated >= floor enabled math standalones for this
// cell yet?"). The generator forces below-floor cells to the top of its
// batch plan, so this table mirrors what runGeneration() will prioritize
// on the next run.
export interface FloorRow {
  kind: 'passage' | 'math_skill';
  bucket: string;
  section?: string;
  skill?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  passage_type?: string;
  count: number;
  floor: number;
  below_floor: boolean;
  deficit: number;
}

export interface FloorStatus {
  skill_floor: number;
  passage_floor: number;
  rows: FloorRow[];
  below_floor_count: number;
}

const DIFFICULTIES: ReadonlyArray<'easy' | 'medium' | 'hard'> = [
  'easy',
  'medium',
  'hard',
];

function numericToVerbal(
  n: number | null | undefined,
): 'easy' | 'medium' | 'hard' | null {
  if (n === 2) return 'easy';
  if (n === 3) return 'medium';
  if (n === 4) return 'hard';
  return null;
}

function sectionForPassageType(p: PassageType): string {
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

// Returns a snapshot of every floor-tracked cell with its current enabled
// count, the active floor, whether it is below floor, and the deficit
// (max(0, floor - count)). Sorted by deficit desc so the most-deficit
// cells (= top priority for the next generation run) bubble to the top.
//
// Uses the service-role client because act.questions / act.passages have
// `using (enabled)` RLS that would hide enabled-false rows from an
// authenticated session — and a low/zero-count cell is exactly what we
// want the admin to see. Authorization is the layout-level requireAdmin().
export async function getFloorStatus(): Promise<FloorStatus> {
  const admin = createAdminClient();

  const cfgRes = await admin
    .schema('act')
    .from('app_config')
    .select('min_skill_floor, min_passage_floor')
    .eq('id', 1)
    .maybeSingle();
  const cfg = (cfgRes.data ?? null) as
    | { min_skill_floor: number | null; min_passage_floor: number | null }
    | null;
  const skillFloor = cfg?.min_skill_floor ?? 3;
  const passageFloor = cfg?.min_passage_floor ?? 1;

  const [passagesRes, mathRes] = await Promise.all([
    admin
      .schema('act')
      .from('passages')
      .select('passage_type')
      .eq('enabled', true),
    admin
      .schema('act')
      .from('questions')
      .select('skill, difficulty')
      .eq('enabled', true)
      .eq('section', 'math')
      .is('passage_id', null),
  ]);

  // Tally passages by passage_type.
  const passageCounts: Partial<Record<PassageType, number>> = {};
  for (const row of (passagesRes.data ?? []) as Array<{
    passage_type: PassageType;
  }>) {
    passageCounts[row.passage_type] = (passageCounts[row.passage_type] ?? 0) + 1;
  }

  // Tally math standalones by (skill, difficulty).
  const mathCounts: Record<string, Record<string, number>> = {};
  for (const row of (mathRes.data ?? []) as Array<{
    skill: string;
    difficulty: number | null;
  }>) {
    const verbal = numericToVerbal(row.difficulty);
    if (!verbal) continue;
    if (!mathCounts[row.skill]) mathCounts[row.skill] = {};
    mathCounts[row.skill][verbal] = (mathCounts[row.skill][verbal] ?? 0) + 1;
  }

  const rows: FloorRow[] = [];

  // 8 passage cells (one per passage_type).
  for (const pt of Object.keys(PASSAGE_QUESTION_COUNTS) as PassageType[]) {
    const count = passageCounts[pt] ?? 0;
    const deficit = Math.max(0, passageFloor - count);
    rows.push({
      kind: 'passage',
      bucket: pt,
      section: sectionForPassageType(pt),
      passage_type: pt,
      count,
      floor: passageFloor,
      below_floor: count < passageFloor,
      deficit,
    });
  }

  // 9 math cells (3 skills × 3 difficulties).
  for (const skill of SKILLS.math) {
    for (const difficulty of DIFFICULTIES) {
      const count = mathCounts[skill]?.[difficulty] ?? 0;
      const deficit = Math.max(0, skillFloor - count);
      rows.push({
        kind: 'math_skill',
        bucket: `math:${skill}:${difficulty}`,
        section: 'math',
        skill,
        difficulty,
        count,
        floor: skillFloor,
        below_floor: count < skillFloor,
        deficit,
      });
    }
  }

  // Sort: highest deficit first, then below-floor first as tiebreak, then
  // bucket name for stability.
  rows.sort((a, b) => {
    if (b.deficit !== a.deficit) return b.deficit - a.deficit;
    if (a.below_floor !== b.below_floor) return a.below_floor ? -1 : 1;
    return a.bucket.localeCompare(b.bucket);
  });

  return {
    skill_floor: skillFloor,
    passage_floor: passageFloor,
    rows,
    below_floor_count: rows.filter((r) => r.below_floor).length,
  };
}
