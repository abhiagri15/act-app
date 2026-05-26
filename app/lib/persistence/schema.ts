import { z } from 'zod';

// Section identifiers. Mirrors ActSection in app/lib/act/format.ts plus
// 'break' for the inter-section rest screen.
export const sectionSchema = z.enum(['english', 'math', 'reading', 'science']);
export const stateSectionSchema = z.enum(['english', 'math', 'break', 'reading', 'science']);

export const choiceSchema = z.enum(['A', 'B', 'C', 'D']);

// One row of the responses payload sent to act.submit_section.
export const submitResponseSchema = z.object({
  question_id: z.string().uuid(),
  selected: choiceSchema.nullable(),
  flagged: z.boolean(),
});
export type SubmitResponse = z.infer<typeof submitResponseSchema>;

export const submitSectionInputSchema = z.object({
  attemptId: z.string().uuid(),
  section: sectionSchema,
  responses: z.array(submitResponseSchema),
});

export const upsertResponseInputSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selected: choiceSchema.nullable(),
  flagged: z.boolean(),
});

export const sectionResultSchema = z.object({
  section: sectionSchema,
  raw_score: z.number().int().min(0),
  scaled_score: z.number().int().min(1).max(36),
  locked: z.boolean(),
});
export type SectionResult = z.infer<typeof sectionResultSchema>;

export const finalResultsSchema = z.object({
  attempt_id: z.string().uuid(),
  composite: z.number().int().min(1).max(36).nullable(),
  scaled_scores: z.record(z.string(), z.number().int().min(1).max(36)),
  raw_scores: z.record(z.string(), z.number().int().min(0)),
  started_at: z.string(),
  submitted_at: z.string().nullable(),
  include_science: z.boolean(),
});
export type FinalResults = z.infer<typeof finalResultsSchema>;

// Shape returned by act.get_my_attempt — used by the test runner (resume)
// and the review page. Note: answer_key/explanation are stripped from
// each question when status === 'in_progress'.
const attemptQuestionSchema = z.object({
  question_id: z.string().uuid(),
  section: sectionSchema,
  skill: z.string(),
  passage_id: z.string().uuid().nullable(),
  passage_marker: z.number().int().nullable(),
  stem: z.string(),
  choices: z.array(z.string()),
  answer_key: choiceSchema.optional(),
  explanation: z.string().optional(),
});

const attemptPassageSchema = z.object({
  id: z.string().uuid(),
  section: z.enum(['english', 'reading', 'science']),
  passage_type: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  // jsonb array of { kind, caption, data } — left loose; rendered defensively.
  stimuli: z.array(z.unknown()).default([]),
});

const attemptResponseSchema = z.object({
  question_id: z.string().uuid(),
  section: sectionSchema,
  selected: choiceSchema.nullable(),
  flagged: z.boolean(),
  is_correct: z.boolean().nullable(),
  answered_at: z.string(),
});

const sectionStateEntrySchema = z.object({
  started_at: z.string(),
  ends_at: z.string(),
  submitted_at: z.string().nullable(),
  locked: z.boolean(),
});

export const attemptSnapshotSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  started_at: z.string(),
  submitted_at: z.string().nullable(),
  status: z.enum(['in_progress', 'submitted', 'abandoned']),
  include_science: z.boolean(),
  current_section: stateSectionSchema.nullable(),
  // Keyed by section name; defensive z.record over string (zod 4's
  // record-with-enum-key insists on every key present).
  section_state: z.record(z.string(), sectionStateEntrySchema).default({}),
  raw_scores: z.record(z.string(), z.number()).default({}),
  scaled_scores: z.record(z.string(), z.number()).default({}),
  composite: z.number().int().min(1).max(36).nullable(),
  passages: z.array(attemptPassageSchema),
  questions: z.array(attemptQuestionSchema),
  responses: z.array(attemptResponseSchema),
});
export type AttemptSnapshot = z.infer<typeof attemptSnapshotSchema>;
export type AttemptQuestion = z.infer<typeof attemptQuestionSchema>;
export type AttemptPassage = z.infer<typeof attemptPassageSchema>;
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;
export type SectionStateEntry = z.infer<typeof sectionStateEntrySchema>;

// Shape returned by act.list_my_attempts (one row per attempt).
export const attemptListItemSchema = z.object({
  id: z.string().uuid(),
  started_at: z.string(),
  submitted_at: z.string().nullable(),
  status: z.enum(['in_progress', 'submitted', 'abandoned']),
  include_science: z.boolean(),
  composite: z.number().int().min(1).max(36).nullable(),
});
export type AttemptListItem = z.infer<typeof attemptListItemSchema>;
