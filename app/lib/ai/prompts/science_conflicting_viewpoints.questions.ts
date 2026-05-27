import { PASSAGE_QUESTION_COUNTS, SKILLS } from '@/app/lib/act/format';
import type { Stimulus } from '../provider';
import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildScienceConflictingViewpointsQuestionsPrompt(
  passageBody: string,
  difficulty: Difficulty,
  _passageStimuli?: Stimulus[],
): string {
  const count = PASSAGE_QUESTION_COUNTS.conflicting_viewpoints; // 7
  const skills = SKILLS.science.join(', ');
  return `Generate ${count} ACT Science questions targeting this Conflicting Viewpoints passage.
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

${difficultyBlock(difficulty)}
ALL ${count} questions must be at the target difficulty (not a mix).

Passage body (verbatim):
"""
${passageBody}
"""

Each object has exactly these keys:
- "section": must be "science"
- "skill": one of [${skills}]
- "stem": the question text (50-250 chars). MUST cite a specific scientist (e.g. "According to Scientist 2...").
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences saying why the correct answer is right, referencing the scientist's stated position

Rules:
- Across the ${count} questions, EACH of the 3 science skills must appear at least once.
- At least two questions must ask about a SINGLE scientist's view (comprehension); at least one must compare or contrast TWO scientists (integration).
- Distractors must be plausible but wrong. Exactly one choice is correct.
- The explanation must NEVER refer to choices by letter. Refer to the correct option as "the correct choice" or by quoting its text.
- Every question must reference at least one specific scientist by name (e.g. "Scientist 1").
- No two questions ask the same thing in different words.`;
}
