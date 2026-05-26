// Verifies ACT format invariants. Run with:
//   pnpm dlx tsx scripts/check-format.ts
// Mirrors SAT's scripts/check-*.ts convention.

import {
  PASSAGE_QUESTION_COUNTS,
  READING_PASSAGE_TYPES,
  SCIENCE_PASSAGE_MIX,
  SECTION_QUESTION_COUNTS,
} from '../app/lib/act/format';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK:   ${msg}`);
}

// English: 5 passages × 10 q = 50
assert(
  PASSAGE_QUESTION_COUNTS.english_essay * 5 === SECTION_QUESTION_COUNTS.english,
  'English: 5 × english_essay (10) = 50',
);

// Reading: 4 passages × 9 q = 36
const readingTotal = READING_PASSAGE_TYPES.reduce(
  (sum, t) => sum + PASSAGE_QUESTION_COUNTS[t],
  0,
);
assert(
  readingTotal === SECTION_QUESTION_COUNTS.reading,
  `Reading: sum of 4 reading passage_types = ${SECTION_QUESTION_COUNTS.reading} (got ${readingTotal})`,
);

// Science: per-mix counts produce 40
const scienceTotal = SCIENCE_PASSAGE_MIX.reduce(
  (sum, { type, count }) => sum + PASSAGE_QUESTION_COUNTS[type] * count,
  0,
);
assert(
  scienceTotal === SECTION_QUESTION_COUNTS.science,
  `Science: SCIENCE_PASSAGE_MIX yields 40 (got ${scienceTotal})`,
);

console.log('\nAll format invariants OK.');
