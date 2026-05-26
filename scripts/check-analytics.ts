// Scripted check for app/lib/analytics/compute.ts.
// This project has no unit-test runner — mirrors the SAT app convention.
// Run: pnpm dlx tsx scripts/check-analytics.ts

import {
  accuracyPct,
  sortSkillsWeakestFirst,
  focusAreas,
  summarize,
  type AnalyticsView,
  type SkillStat,
} from '../app/lib/analytics/compute';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  ok —', msg);
}

// --- accuracyPct ---
assert(accuracyPct(0, 0) === 0, 'accuracyPct(0,0) === 0');
assert(accuracyPct(1, 2) === 50, 'accuracyPct(1,2) === 50');
assert(accuracyPct(2, 3) === 66.7, 'accuracyPct(2,3) === 66.7 (1 decimal)');
assert(accuracyPct(10, 10) === 100, 'accuracyPct(10,10) === 100');

// --- sortSkillsWeakestFirst ---
const skills: SkillStat[] = [
  { section: 'english', skill: 'knowledge_of_language', total: 10, correct: 9 },
  { section: 'english', skill: 'production_of_writing', total: 10, correct: 3 },
  { section: 'math', skill: 'modeling', total: 8, correct: 4 },
  { section: 'math', skill: 'integrating_essential_skills', total: 4, correct: 2 },
  { section: 'reading', skill: 'key_ideas_and_details', total: 6, correct: 6 },
  { section: 'science', skill: 'interpretation_of_data', total: 2, correct: 0 },
];

const sorted = sortSkillsWeakestFirst(skills);
assert(
  sorted[0].skill === 'interpretation_of_data',
  'weakest sorts first (0%, science)',
);
assert(
  sorted[sorted.length - 1].skill === 'key_ideas_and_details',
  'strongest sorts last (100%, reading)',
);
assert(
  sorted[2].skill === 'modeling' && sorted[3].skill === 'integrating_essential_skills',
  '50% tie broken by total desc (math modeling 8 before integrating 4)',
);

// --- focusAreas ---
// 'interpretation_of_data' (0%, 2 attempts) is the weakest but below the
// 5-attempt floor — focus areas must exclude it.
const focus = focusAreas(skills, 3);
assert(focus.length === 3, 'focusAreas returns 3');
assert(
  focus.every((s) => s.total >= 5),
  'focusAreas drops skills with <5 attempts',
);
assert(
  focus[0].skill === 'production_of_writing',
  'focus area 0 is the weakest with >=5 attempts (production_of_writing, 30%)',
);
assert(focusAreas([], 3).length === 0, 'focusAreas([]) is empty');

// --- summarize ---
const view: AnalyticsView = {
  tests_taken: 3,
  latest_composite: 24,
  avg_composite: 22.3,
  best_composite: 28,
  trend: [],
  sections: {},
  skills,
};
const sum = summarize(view);
assert(sum.testsTaken === 3, 'summarize.testsTaken === 3');
assert(sum.latest === 24, 'summarize.latest === 24');
assert(sum.avg === 22.3, 'summarize.avg === 22.3');
assert(sum.best === 28, 'summarize.best === 28');

const empty = summarize({
  tests_taken: 0,
  latest_composite: null,
  avg_composite: null,
  best_composite: null,
  trend: [],
  sections: {},
  skills: [],
});
assert(
  empty.testsTaken === 0 &&
    empty.latest === null &&
    empty.avg === null &&
    empty.best === null,
  'summarize() on empty view returns 0 tests and nulls (not 0s) for composites',
);

console.log('\nALL CHECKS PASSED');
