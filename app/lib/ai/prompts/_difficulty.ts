// Verbal-to-numeric mapping. act.questions.difficulty is smallint 1-5; we use
// 2/3/4 for easy/medium/hard. 1 and 5 are reserved for future calibration.
export type Difficulty = 'easy' | 'medium' | 'hard';

export function verbalToNumeric(d: Difficulty): number {
  if (d === 'easy') return 2;
  if (d === 'medium') return 3;
  return 4;
}

// Shared calibration paragraph injected into every prompt builder. Keeps the
// 19 prompt files in sync — if you tune the descriptors, do it here.
export function difficultyBlock(d: Difficulty): string {
  return `Target difficulty: ${d}.
  - easy   = single-step reasoning, common vocabulary, ~6th-9th grade reading level
  - medium = 2-step reasoning, grade-appropriate vocabulary (10th-12th grade)
  - hard   = multi-step reasoning, sophisticated vocabulary, subtle distractor design`;
}
