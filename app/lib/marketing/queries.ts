// app/lib/marketing/queries.ts
//
// Public-page data fetchers for the marketing /how-it-works page.
//
// Uses the service-role client to count rows in act.questions / act.passages,
// because the act.questions RLS policy is `using (enabled)` — over the
// anon/authenticated role we'd see only enabled rows, and the marketing page
// wants to show real pool counts including the cells the moderation pipeline
// has temporarily disabled. The route is public, but the values we expose
// (aggregate counts) are not sensitive.

import { createAdminClient } from '@/app/lib/supabase/admin';
import type { ActSection } from '@/app/lib/act/format';

export interface PublicPoolSectionStat {
  section: ActSection;
  label: string;
  questions: number;
  questionsTarget: number | null;
  passages: number;
  passagesTarget: number | null;
}

export interface PublicPoolStats {
  totalQuestions: number;
  totalPassages: number;
  sections: PublicPoolSectionStat[];
  lastRefreshed: string | null; // ISO timestamp of most recent enabled question
  asOf: string;                  // ISO timestamp of when this query ran
}

// Per-section target counts. Mirrors the warm-pool / draw-test minimums.
// English: 5 passages × 10q  = 50  (target 8 passages → ~80q)
// Reading: 4 passages × 9q   = 36  (target 8 passages → ~72q)
// Science: 7 passages × mix  = 40  (target 12 passages → ~70q)
// Math:    standalone, 45q drawn per test (target ~150)
const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

const QUESTION_TARGETS: Record<ActSection, number> = {
  english: 150,
  math: 150,
  reading: 150,
  science: 150,
};

const PASSAGE_TARGETS: Record<ActSection, number | null> = {
  english: 16,
  math: null,
  reading: 16,
  science: 24,
};

// Returns null on any error so the calling page can render a graceful
// fallback. We never throw across this boundary.
export async function getPublicPoolStats(): Promise<PublicPoolStats | null> {
  try {
    const admin = createAdminClient();
    const [qRes, pRes] = await Promise.all([
      admin
        .schema('act')
        .from('questions')
        .select('section, enabled, created_at'),
      admin
        .schema('act')
        .from('passages')
        .select('section, enabled'),
    ]);
    if (qRes.error || pRes.error) {
      console.error('[getPublicPoolStats] query error:', qRes.error ?? pRes.error);
      return null;
    }
    const qRows = (qRes.data ?? []) as {
      section: ActSection;
      enabled: boolean;
      created_at: string;
    }[];
    const pRows = (pRes.data ?? []) as {
      section: ActSection;
      enabled: boolean;
    }[];

    const enabledQuestions = qRows.filter((r) => r.enabled);
    const enabledPassages = pRows.filter((r) => r.enabled);

    const sections: PublicPoolSectionStat[] = (
      ['english', 'math', 'reading', 'science'] as const
    ).map((section) => ({
      section,
      label: SECTION_LABELS[section],
      questions: enabledQuestions.filter((r) => r.section === section).length,
      questionsTarget: QUESTION_TARGETS[section],
      passages: enabledPassages.filter((r) => r.section === section).length,
      passagesTarget: PASSAGE_TARGETS[section],
    }));

    const lastRefreshed = enabledQuestions
      .map((r) => r.created_at)
      .sort()
      .reverse()[0] ?? null;

    return {
      totalQuestions: enabledQuestions.length,
      totalPassages: enabledPassages.length,
      sections,
      lastRefreshed,
      asOf: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[getPublicPoolStats] unexpected error:', e);
    return null;
  }
}
