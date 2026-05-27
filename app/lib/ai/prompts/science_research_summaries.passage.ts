import { difficultyBlock, type Difficulty } from './_difficulty';

export function buildScienceResearchSummariesPassage(
  difficulty: Difficulty,
): string {
  return `Generate one ACT Science "Research Summaries" passage.
${difficultyBlock(difficulty)}
The passage's vocabulary level AND the implied difficulty of any questions written from it must match the target difficulty.

Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "research_summaries",
  "title": "<3-12 words>",
  "body": "<400-600 words. Describe a series of 2 or 3 related experiments. For each experiment, give: a brief hypothesis or question, the methodology / variables manipulated, and a one-sentence pointer to the table(s) showing results. Label experiments 'Experiment 1', 'Experiment 2', (optionally 'Experiment 3'). Third-person scientific tone.>",
  "stimuli": [
    {
      "kind": "table",
      "caption": "<e.g. 'Table 1: Experiment 1 results — variable X vs. measurement Y'>",
      "data": { "headers": ["<col1>", "<col2>", "..."], "rows": [["<r1c1>", "<r1c2>", "..."]] }
    }
  ]
}
Rules:
- The body must describe 2-3 experiments.
- Provide 1-2 table stimuli; each table is { "headers": [...], "rows": [[...], ...] } with at least 3 columns and 3 rows.
- Captions must clearly identify which experiment each table belongs to.
- The 6 questions that follow MUST be answerable from the stimuli + body alone.
- The body must NOT mention "ACT", "test", "passage", "question", or "choice".`;
}
