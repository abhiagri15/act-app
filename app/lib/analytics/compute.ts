// Pure analytics helpers — no I/O, no React. Exercised by
// scripts/check-analytics.ts (this project has no unit-test runner).

import type { ActSection } from '@/app/lib/act/format';

export interface SkillStat {
  section: ActSection;
  skill: string;
  correct: number;
  total: number;
}

export interface SectionStat {
  section: ActSection;
  correct: number;
  total: number;
}

export interface TrendPoint {
  attempt_id: string;
  submitted_at: string;
  composite: number;
  // The four scaled section scores. When include_science=false, the
  // payload may omit the 'science' key entirely (the RPC just serializes
  // whatever is in act.test_attempts.scaled_scores).
  scaled_scores: Partial<Record<ActSection, number>>;
  include_science: boolean;
}

// Shape returned by act.user_analytics() — matches the jsonb the RPC builds.
// Note `sections` is an object keyed by section name (NOT an array, unlike
// the SAT view), and `tests_taken` is the count of submitted attempts.
export interface AnalyticsView {
  tests_taken: number;
  latest_composite: number | null;
  avg_composite: number | null;
  best_composite: number | null;
  trend: TrendPoint[];
  sections: Partial<Record<ActSection, { correct: number; total: number }>>;
  skills: SkillStat[];
}

// Percent correct, 0-100, one decimal place. 0 when no questions.
export function accuracyPct(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((1000 * correct) / total) / 10;
}

// Skills ascending by accuracy; ties → more-answered first, then skill name.
export function sortSkillsWeakestFirst(skills: SkillStat[]): SkillStat[] {
  return [...skills].sort((a, b) => {
    const pa = accuracyPct(a.correct, a.total);
    const pb = accuracyPct(b.correct, b.total);
    if (pa !== pb) return pa - pb;
    if (a.total !== b.total) return b.total - a.total;
    return a.skill.localeCompare(b.skill);
  });
}

// The n weakest skills the user has actually attempted enough of. We require
// >= 5 attempts on a skill before it qualifies as a focus area — a single
// missed question shouldn't dominate the recommendation.
export function focusAreas(skills: SkillStat[], maxCount = 3): SkillStat[] {
  return sortSkillsWeakestFirst(skills.filter((s) => s.total >= 5)).slice(0, maxCount);
}

// Summary stats lifted off the analytics view. Returns nulls (not 0s) when
// no tests have been taken so the UI can render "—" rather than a meaningless 0.
export function summarize(view: AnalyticsView): {
  testsTaken: number;
  latest: number | null;
  avg: number | null;
  best: number | null;
} {
  return {
    testsTaken: view.tests_taken,
    latest: view.latest_composite,
    avg: view.avg_composite,
    best: view.best_composite,
  };
}
