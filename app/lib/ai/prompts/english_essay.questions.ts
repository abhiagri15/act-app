import { PASSAGE_QUESTION_COUNTS, SKILLS } from '@/app/lib/act/format';
import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildEnglishEssayQuestionsPrompt(
  passageBody: string,
  difficulty: Difficulty,
): string {
  const count = PASSAGE_QUESTION_COUNTS.english_essay; // 10
  const skills = SKILLS.english.join(', ');
  return `Generate ${count} ACT English questions targeting this passage.
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

${difficultyBlock(difficulty)}
ALL ${count} questions must be at the target difficulty (not a mix).

Passage (verbatim — do NOT modify it):
"""
${passageBody}
"""

Each object has exactly these keys:
- "section": must be "english"
- "skill": one of [${skills}]
- "passage_marker": integer 1..10 (the [[N]] marker in the passage this question targets)
- "stem": the question text (e.g. "Which choice best replaces the underlined word at [[3]]?")
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences saying why the correct answer is right

Rules:
- Every question MUST set "passage_marker" to a distinct integer in 1..10.
- The 10 markers must each be covered exactly once across the ${count} questions.
- Across the ${count} questions, EACH of the 3 english skills must appear at least once.
- Distractors must be plausible but wrong. Exactly one choice is correct.
- The explanation must NEVER refer to choices by letter ("Choice A...", "Option B..."). Refer to the correct option as "the correct choice" or by quoting its text. The app shuffles choices.
- Every question must be answerable from the passage alone (no outside knowledge).
- No two questions ask the same thing in different words.`;
}
