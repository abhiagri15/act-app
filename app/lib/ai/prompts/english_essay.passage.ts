export function buildEnglishEssayPassage(): string {
  return `Generate one ACT English passage (a short essay or article).
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "english_essay",
  "title": "<3-12 words>",
  "body": "<350-500 words of expository prose. The passage MUST contain exactly 10 inline editing markers numbered [[1]] through [[10]], placed where a sentence-revision or grammar question would target the surrounding text. The markers correspond 1:1 to the 10 ACT English questions that will be generated for this passage. Use a clear, journalistic, first-person or third-person tone — biography, personal memoir, history, science, arts, or community essay. No real published works cited verbatim. No markdown. No headers. No lists.>"
}
Rules:
- The body MUST contain exactly 10 markers of the form [[1]], [[2]], ..., [[10]] in order.
- Each marker must appear at a syntactically meaningful spot (mid-sentence, between sentences) so a question can ask about wording at that location.
- The body must NOT mention "ACT", "test", "passage", "question", or "choice" — it is an article.`;
}
