// One-shot smoke test for app/lib/ai/generate.ts.
// Run with: pnpm dlx tsx --env-file=.env.local scripts/smoke-generate.ts

import { runGeneration } from '../app/lib/ai/generate';

async function main() {
  const result = await runGeneration({ maxBatches: 1 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('ERR:', e);
  process.exit(1);
});
