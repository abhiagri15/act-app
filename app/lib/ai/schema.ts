import { z } from 'zod';

// Shape an AI-generated passage candidate must satisfy. Inserted into act.passages
// after validation. Stimuli are schema-permissive — tables are 2D arrays, figures
// are { axes, series } — but we don't deeply validate either.
export const passageCandidateSchema = z.object({
  passage_type: z.enum([
    'english_essay',
    'literary_narrative',
    'social_science',
    'humanities',
    'natural_science',
    'data_representation',
    'research_summaries',
    'conflicting_viewpoints',
  ]),
  title: z.string().min(3).max(200),
  body: z.string().min(50).max(8000),
  stimuli: z
    .array(
      z.object({
        kind: z.enum(['table', 'figure']),
        caption: z.string(),
        data: z.unknown(),
      }),
    )
    .optional(),
});

// Shape an AI-generated question candidate must satisfy. Inserted into
// act.questions after passing the self-verify gate. `skill` is validated
// against SKILLS[section] outside zod (we keep zod loose so the error
// message is more readable in generate.ts).
export const questionCandidateSchema = z.object({
  section: z.enum(['english', 'math', 'reading', 'science']),
  skill: z.string(),
  stem: z.string().min(5).max(2000),
  choices: z
    .array(
      z.object({
        key: z.enum(['A', 'B', 'C', 'D']),
        text: z.string().min(1).max(500),
      }),
    )
    .length(4),
  answer_key: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(10).max(2000),
  // English-only; the questions-for-English-passage prompt requires it
  // (in [1..10]); other sections never set it.
  passage_marker: z.number().int().min(1).max(20).optional(),
});

export type PassageCandidate = z.infer<typeof passageCandidateSchema>;
export type QuestionCandidate = z.infer<typeof questionCandidateSchema>;
