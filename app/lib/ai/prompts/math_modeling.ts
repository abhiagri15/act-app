import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildModelingMathPrompt(
  count: number,
  difficulty: Difficulty,
): string {
  return `Generate ${count} original ACT Math multiple-choice questions for the skill "modeling".
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

${difficultyBlock(difficulty)}
ALL ${count} questions must be at the target difficulty (not a mix).

Each object has exactly these keys:
- "section": must be "math"
- "skill": must be "modeling"
- "stem": the math problem (60-350 chars). MUST be a real-world / applied-context word problem.
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences showing the steps that translate the real-world scenario into math and solve it

Topical coverage for "modeling": problems that require building, interpreting, or evaluating a mathematical model of a real-world situation — linear / exponential growth, system optimization, geometric measurement in context, probability / statistics in context, interpreting graphs of real phenomena.

Rules:
- Each problem must present a realistic real-world scenario (finance, science, sports, manufacturing, daily life) — NOT a pure algebraic equation.
- Exactly one choice is correct.
- The other 3 choices must be plausible distractors (e.g. forgetting a unit conversion, swapping rate and total).
- The explanation must NEVER refer to choices by letter. Refer to the correct option as "the correct choice" or by quoting its content.
- Use plain text only — no LaTeX, no markdown. Write "x^2" for x², "sqrt(2)" for √2, "pi" for π.
- Units of measurement (m, kg, s, $, etc.) belong in the stem and choices where appropriate.
- No two questions ask the same thing in different words.`;
}
