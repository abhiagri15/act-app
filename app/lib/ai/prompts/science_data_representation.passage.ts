import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildScienceDataRepresentationPassage(
  difficulty: Difficulty,
): string {
  return `Generate one ACT Science "Data Representation" passage.
${difficultyBlock(difficulty)}
The passage's vocabulary level AND the implied difficulty of any questions written from it must match the target difficulty.

Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "data_representation",
  "title": "<3-12 words>",
  "body": "<200-350 words of brief methodological context: what was measured, how, why. Third-person, scientific tone. The body sets up the data — the actual numbers live in stimuli.>",
  "stimuli": [
    {
      "kind": "table",
      "caption": "<short caption naming the table, e.g. 'Table 1: Reaction yield by temperature'>",
      "data": { "headers": ["<col1>", "<col2>", "..."], "rows": [["<r1c1>", "<r1c2>", "..."], ["<r2c1>", "<r2c2>", "..."]] }
    }
  ]
}
Rules:
- Provide EXACTLY ONE stimulus: either one "table" OR one "figure" (not both, not zero).
- For a table, "data" is { "headers": [...], "rows": [[...], ...] } with at least 3 columns and 4 rows.
- For a figure, "data" is { "axes": { "x": "<label>", "y": "<label>" }, "series": [{ "name": "<name>", "points": [[x1,y1], ...] }] }.
- The 5 questions that follow MUST be answerable from the stimulus + body alone.
- The body must NOT mention "ACT", "test", "passage", "question", or "choice".`;
}
