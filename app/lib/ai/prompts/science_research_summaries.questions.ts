import { PASSAGE_QUESTION_COUNTS, SKILLS } from '@/app/lib/act/format';
import type { Stimulus } from '../provider';
import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildScienceResearchSummariesQuestionsPrompt(
  passageBody: string,
  difficulty: Difficulty,
  passageStimuli?: Stimulus[],
): string {
  const count = PASSAGE_QUESTION_COUNTS.research_summaries; // 6
  const skills = SKILLS.science.join(', ');
  const stimuliJson = JSON.stringify(passageStimuli ?? [], null, 2);
  return `Generate ${count} ACT Science questions targeting this Research Summaries passage.
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

${difficultyBlock(difficulty)}
ALL ${count} questions must be at the target difficulty (not a mix).

Passage body (verbatim):
"""
${passageBody}
"""

Stimuli (verbatim — refer to row/column/figure labels exactly as they appear):
${stimuliJson}

Each object has exactly these keys:
- "section": must be "science"
- "skill": one of [${skills}]
- "stem": the question text (50-250 chars). MUST cite a specific experiment, row, column, or figure label.
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences saying why the correct answer is right, referencing the stimulus

Rules:
- Across the ${count} questions, EACH of the 3 science skills must appear at least once.
- Distractors must be plausible but wrong. Exactly one choice is correct.
- The explanation must NEVER refer to choices by letter. Refer to the correct option as "the correct choice" or by quoting its text.
- Every question must cite at least one row/column/figure label from the stimulus or name a specific experiment.
- No two questions ask the same thing in different words.`;
}
