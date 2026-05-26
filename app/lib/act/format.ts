// ACT structural facts. Source of truth — referenced by the AI generator,
// the test runner, the n8n workflow, and analytics. Keep in sync with
// the spec at docs/superpowers/specs/2026-05-26-act-app-overview-design.md.

export type ActSection = 'english' | 'math' | 'reading' | 'science';

export const SECTION_ORDER: readonly ActSection[] = [
  'english',
  'math',
  'reading',
  'science',
] as const;

// Enhanced ACT (2025+).
export const SECTION_QUESTION_COUNTS: Record<ActSection, number> = {
  english: 50,
  math: 45,
  reading: 36,
  science: 40,
};

// In seconds.
export const SECTION_DURATIONS_SEC: Record<ActSection, number> = {
  english: 35 * 60,
  math: 50 * 60,
  reading: 40 * 60,
  science: 40 * 60,
};

export const BREAK_DURATION_SEC = 10 * 60;

export type PassageType =
  | 'english_essay'
  | 'literary_narrative'
  | 'social_science'
  | 'humanities'
  | 'natural_science'
  | 'data_representation'
  | 'research_summaries'
  | 'conflicting_viewpoints';

// Per-passage-type fixed question count. Enforced by both act.draw_test and
// the n8n Parse Q Candidates gate. See spec §3.2.
export const PASSAGE_QUESTION_COUNTS: Record<PassageType, number> = {
  english_essay: 10,
  literary_narrative: 9,
  social_science: 9,
  humanities: 9,
  natural_science: 9,
  data_representation: 5,
  research_summaries: 6,
  conflicting_viewpoints: 7,
};

// Real Enhanced ACT Science distribution: 40 questions across 7 passages.
export const SCIENCE_PASSAGE_MIX: Array<{ type: PassageType; count: number }> = [
  { type: 'data_representation', count: 3 },   // 3 × 5 = 15
  { type: 'research_summaries', count: 3 },    // 3 × 6 = 18
  { type: 'conflicting_viewpoints', count: 1 },// 1 × 7 = 7
];                                              // total: 40

export const READING_PASSAGE_TYPES: PassageType[] = [
  'literary_narrative',
  'social_science',
  'humanities',
  'natural_science',
];

// Per-section skill taxonomy. See spec §3.4.
export const SKILLS: Record<ActSection, readonly string[]> = {
  english: [
    'production_of_writing',
    'knowledge_of_language',
    'conventions_of_standard_english',
  ],
  math: [
    'preparing_for_higher_math',
    'integrating_essential_skills',
    'modeling',
  ],
  reading: [
    'key_ideas_and_details',
    'craft_and_structure',
    'integration_of_knowledge',
  ],
  science: [
    'interpretation_of_data',
    'scientific_investigation',
    'evaluation_of_models',
  ],
};
