import { difficultyBlock, type Difficulty } from './_difficulty';

const STYLES = [
  {
    key: 'personal_narrative',
    description:
      'a first-person personal narrative passage — a memoir-style excerpt about a meaningful experience, written by the narrator about themselves. Use a reflective, conversational tone. 350-500 words. Include sensory detail and a sense of time/place.',
  },
  {
    key: 'informational_science',
    description:
      'an informational article about a science topic (biology, chemistry, physics, earth science, or technology). Use a third-person journalistic tone, neutral and explanatory. 350-500 words. Include at least one specific researcher or institution.',
  },
  {
    key: 'informational_history',
    description:
      'an informational article about a historical event, person, or movement. Use a third-person journalistic tone. 350-500 words. Include a specific date, place, and named person.',
  },
  {
    key: 'biographical',
    description:
      "a biographical sketch of a real or realistic-fictional person's life and contributions. Use a third-person narrative tone. 350-500 words. Include specific accomplishments and an inflection-point moment.",
  },
  {
    key: 'persuasive',
    description:
      'a persuasive essay arguing one side of a contemporary issue (technology, education, environment, public policy). Use a first-person or rhetorical tone with a clear thesis. 350-500 words. Include 2-3 supporting reasons.',
  },
];

export function buildEnglishEssayPassage(difficulty: Difficulty): string {
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  return `Generate one ACT English passage in this style: ${style.description}

${difficultyBlock(difficulty)}
The passage's vocabulary level AND the implied difficulty of any questions written from it must match the target difficulty.

Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "english_essay",
  "title": "<3-12 words>",
  "body": "<the passage, 350-500 words>"
}

CRITICAL — embed exactly 10 inline markers as the literal token "[[1]]", "[[2]]", through "[[10]]", at points in the body where an English/grammar/style question could be written. Each marker MUST appear exactly once. Each marker MUST be at a single distinct insertion point (e.g., a word, phrase, or punctuation site that a question could ask about). DO NOT cluster all markers in one paragraph — distribute across the passage.

The body must NOT use markdown formatting (no asterisks, no headers, no lists).
The body must NOT mention "ACT", "test", "passage", "question", or "choice" — it is content, not a test artifact.
The body must NOT include any literal text matching "[[" or "]]" other than the 10 numbered markers.`;
}
