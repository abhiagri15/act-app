export function buildScienceConflictingViewpointsPassage(): string {
  return `Generate one ACT Science "Conflicting Viewpoints" passage.
Return ONLY a JSON object — no prose, no markdown fences.
{
  "passage_type": "conflicting_viewpoints",
  "title": "<3-12 words>",
  "body": "<450-650 words. A brief shared-context introduction (50-100 words) followed by 2-4 scientist viewpoints, each named exactly 'Scientist 1', 'Scientist 2', etc. Each scientist's section is 100-150 words, presents a distinct, internally-consistent hypothesis or interpretation of a phenomenon, and gives at least one supporting reason. The viewpoints must conflict on the central claim while sharing the same context. Third-person scientific tone.>"
}
Rules:
- Provide NO stimuli — omit the field entirely. (Conflicting Viewpoints is text-only.)
- Each scientist's section must be clearly labeled with the heading 'Scientist 1', 'Scientist 2', etc., embedded inline in the body.
- Each scientist must hold a distinct, internally consistent position; their disagreements must be on substantive points, not phrasing.
- The body must NOT mention "ACT", "test", "passage", "question", or "choice".`;
}
