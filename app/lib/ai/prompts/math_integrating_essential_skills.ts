import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildIntegratingEssentialSkillsPrompt(
  count: number,
  difficulty: Difficulty,
): string {
  return `Generate ${count} original ACT Math multiple-choice questions for the skill "integrating_essential_skills".
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

${difficultyBlock(difficulty)}
ALL ${count} questions must be at the target difficulty (not a mix).

Each object has exactly these keys:
- "section": must be "math"
- "skill": must be "integrating_essential_skills"
- "stem": the math problem (50-300 chars)
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences showing the steps that lead to the correct answer

Topical coverage for "integrating_essential_skills": rates, percentages, proportional reasoning, area, surface area, volume, average, median, expressions with variables, and word problems that combine these. The hallmark is multi-step problems requiring synthesis of pre-algebra / Algebra 1 / geometry skills.

Rules:
- Each problem is fully self-contained — no passage, no figure references in the stem.
- Exactly one choice is correct.
- The other 3 choices must be plausible distractors based on common student errors.
- The explanation must NEVER refer to choices by letter. Refer to the correct option as "the correct choice" or by quoting its content.
- Use plain text only — no LaTeX, no markdown. Write "x^2" for x², "sqrt(2)" for √2, "pi" for π.
- No two questions ask the same thing in different words.`;
}
