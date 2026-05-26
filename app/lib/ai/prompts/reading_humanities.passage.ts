export function buildReadingHumanitiesPassage(): string {
  return `Generate one ACT Reading "Humanities" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "humanities",
  "title": "<3-12 words>",
  "body": "<400-600 words. Expository or personal-essay prose about a humanities topic: art, dance, ethics, film, language, literary criticism, music, philosophy, radio, television, or theater. Reflective tone, may be first-person. Include at least one specific artist / work / dated event for realism. Cite no real works verbatim. No markdown, no headers, no lists.>"
}
The body must be self-contained: questions will reference it without rereading.
The body must NOT mention "ACT", "test", "passage", "question", or "choice".`;
}
