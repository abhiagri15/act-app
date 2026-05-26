import { z } from 'zod';

// Whitelist of reasons. Mirrors the SQL CHECK constraint on
// act.question_flags.reason and act.submit_flag's role check.
export const flagReasonSchema = z.enum([
  'incorrect_answer',
  'ambiguous',
  'typo',
  'other',
]);
export type FlagReason = z.infer<typeof flagReasonSchema>;

// Input to the submitFlag server action.
export const submitFlagSchema = z.object({
  question_id: z.string().uuid(),
  reason: flagReasonSchema,
  notes: z.string().max(500).optional(),
});
export type SubmitFlagInput = z.infer<typeof submitFlagSchema>;

// Friendly labels for the FlagQuestion UI + admin FlagRow.
export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  incorrect_answer: 'Incorrect answer',
  ambiguous: 'Ambiguous wording',
  typo: 'Typo',
  other: 'Other',
};
