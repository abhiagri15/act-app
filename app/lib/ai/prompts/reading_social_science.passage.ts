export function buildReadingSocialSciencePassage(): string {
  return `Generate one ACT Reading "Social Science" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "social_science",
  "title": "<3-12 words>",
  "body": "<400-600 words. Expository prose about a social-science topic: anthropology, archaeology, economics, education, geography, history, political science, psychology, or sociology. Third-person, analytical tone. Include at least one specific researcher / institution / dated event for realism. Cite no real published papers verbatim. No markdown, no headers, no lists.>"
}
The body must be self-contained: questions will reference it without rereading.
The body must NOT mention "ACT", "test", "passage", "question", or "choice" — it is an article.`;
}
