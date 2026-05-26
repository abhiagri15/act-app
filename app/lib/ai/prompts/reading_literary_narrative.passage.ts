export function buildReadingLiteraryNarrativePassage(): string {
  return `Generate one ACT Reading "Literary Narrative" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "literary_narrative",
  "title": "<3-12 words>",
  "body": "<400-600 words. An excerpt from a novel-like or short-story-like text. Third- or first-person narrator. Include scene, character interiority, and at least one specific concrete detail. Do NOT cite a real published novel verbatim — write a fresh excerpt in a literary tone. No markdown, no headers, no lists.>"
}
The body must be self-contained: questions will reference it without rereading.
The body must NOT mention "ACT", "test", "passage", "question", or "choice".`;
}
