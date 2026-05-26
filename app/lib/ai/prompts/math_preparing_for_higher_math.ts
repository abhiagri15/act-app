export function buildPreparingForHigherMathPrompt(count: number): string {
  return `Generate ${count} original ACT Math multiple-choice questions for the skill "preparing_for_higher_math".
Return ONLY a JSON array of ${count} objects — no prose, no markdown fences.

Each object has exactly these keys:
- "section": must be "math"
- "skill": must be "preparing_for_higher_math"
- "stem": the math problem (50-300 chars)
- "choices": array of exactly 4 objects {key, text} with keys A,B,C,D in that order
- "answer_key": one of "A","B","C","D"
- "explanation": 1-3 sentences showing the steps that lead to the correct answer

Topical coverage for "preparing_for_higher_math": number & quantity, algebra (linear / exponential / polynomial / rational), functions, geometry, statistics & probability. Pick problems that resemble standalone ACT Math questions — no extra passage, just a self-contained problem.

Rules:
- Each problem is fully self-contained — no passage, no figure references in the stem (you may describe a figure in words, e.g. "a triangle with legs 3 and 4").
- Exactly one choice is the correct, unambiguous answer.
- The other 3 choices must be plausible distractors — values a student might compute via common errors (sign flip, dropped term, swapped variable).
- The explanation must NEVER refer to choices by letter ("Choice A...", "Option B..."). Refer to the correct option as "the correct choice" or by quoting its content.
- Use plain text only — no LaTeX, no markdown. Write "x^2" for x², "sqrt(2)" for √2, "pi" for π unless a decimal is more natural.
- No two questions ask the same thing in different words.`;
}
