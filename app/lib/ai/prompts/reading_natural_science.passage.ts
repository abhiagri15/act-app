export function buildReadingNaturalSciencePassage(): string {
  return `Generate one ACT Reading "Natural Science" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "natural_science",
  "title": "<3-12 words>",
  "body": "<400-600 words of expository prose about a scientific topic — physics, biology, chemistry, earth science, or astronomy. Use a third-person, journalistic tone. Include at least one specific researcher / institution / dated event for realism. Cite no real published papers verbatim. No markdown, no headers, no lists.>"
}
The body must be self-contained: questions will reference it without rereading.
The body must NOT mention "ACT", "test", "passage", "question", or "choice" — it is an article.`;
}
