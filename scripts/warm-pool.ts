// Cold-start pool warmer. Run after first deploy with:
//   pnpm dlx tsx --env-file=.env.local scripts/warm-pool.ts
//
// Calls runGeneration({ maxBatches: 6 }) in a loop until all buffer targets
// are met or 20 iterations elapse (whichever first). Prints progress.

import { runGeneration } from '../app/lib/ai/generate';
import { createAdminClient } from '../app/lib/supabase/admin';
import { SKILLS } from '../app/lib/act/format';

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

async function isFull(): Promise<boolean> {
  const supabase = createAdminClient();
  const act = supabase.schema('act');

  for (const [type, target] of Object.entries(TARGETS)) {
    const { count } = await act
      .from('passages')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
      .eq('passage_type', type);
    if ((count ?? 0) < target) return false;
  }

  for (const skill of SKILLS.math) {
    const { count } = await act
      .from('questions')
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
    const t0 = Date.now();
    console.log(`Iteration ${i}: pool not full, running generation...`);
    const result = await runGeneration({ maxBatches: 6, logRunRow: true });
    const dt = Math.round((Date.now() - t0) / 1000);
    console.log(
      `  iter=${i} generated=${result.generated} batches=${result.batches ?? 0} errors=${result.errors?.length ?? 0} elapsed=${dt}s`,
    );
    if (result.errors && result.errors.length > 0) {
      for (const e of result.errors) console.log(`    ! ${e.bucket}: ${e.message}`);
    }
  }
  console.log(
    'Reached 20 iterations; pool may still be partial — check generation_runs.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
