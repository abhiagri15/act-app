import { PASSAGE_QUESTION_COUNTS, SKILLS } from '@/app/lib/act/format';

export function buildReadingHumanitiesQuestionsPrompt(
  passageBody: string,
): string {
  const count = PASSAGE_QUESTION_COUNTS.humanities; // 9
  const skills = SKILLS.reading.join(', ');
  return `Generate ${count} ACT Reading questions targeting this Humanities passage.
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

Passage (verbatim — do NOT modify it):
"""
${passageBody}
"""

Each object has exactly these keys:
- "section": must be "reading"
- "skill": one of [${skills}]
- "stem": the question text (50-250 chars)
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences saying why the correct answer is right

Rules:
- Across the ${count} questions, EACH of the 3 reading skills must appear at least once.
- Distractors must be plausible but wrong. Exactly one choice is correct.
- The explanation must NEVER refer to choices by letter ("Choice A...", "Option B..."). Refer to the correct option as "the correct choice" or by quoting its text.
- Every question must be answerable from the passage alone (no outside knowledge).
- No two questions ask the same thing in different words.`;
}
