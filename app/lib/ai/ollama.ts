import type { AIProvider, Stimulus } from './provider';
import type { PassageCandidate, QuestionCandidate } from './schema';
import type { PassageType } from '@/app/lib/act/format';
import type { Difficulty } from './prompts/_difficulty';

import { buildEnglishEssayPassage } from './prompts/english_essay.passage';
import { buildEnglishEssayQuestionsPrompt } from './prompts/english_essay.questions';
import { buildReadingLiteraryNarrativePassage } from './prompts/reading_literary_narrative.passage';
import { buildReadingLiteraryNarrativeQuestionsPrompt } from './prompts/reading_literary_narrative.questions';
import { buildReadingSocialSciencePassage } from './prompts/reading_social_science.passage';
import { buildReadingSocialScienceQuestionsPrompt } from './prompts/reading_social_science.questions';
import { buildReadingHumanitiesPassage } from './prompts/reading_humanities.passage';
import { buildReadingHumanitiesQuestionsPrompt } from './prompts/reading_humanities.questions';
import { buildReadingNaturalSciencePassage } from './prompts/reading_natural_science.passage';
import { buildReadingNaturalScienceQuestionsPrompt } from './prompts/reading_natural_science.questions';
import { buildScienceDataRepresentationPassage } from './prompts/science_data_representation.passage';
import { buildScienceDataRepresentationQuestionsPrompt } from './prompts/science_data_representation.questions';
import { buildScienceResearchSummariesPassage } from './prompts/science_research_summaries.passage';
import { buildScienceResearchSummariesQuestionsPrompt } from './prompts/science_research_summaries.questions';
import { buildScienceConflictingViewpointsPassage } from './prompts/science_conflicting_viewpoints.passage';
import { buildScienceConflictingViewpointsQuestionsPrompt } from './prompts/science_conflicting_viewpoints.questions';
import { buildPreparingForHigherMathPrompt } from './prompts/math_preparing_for_higher_math';
import { buildIntegratingEssentialSkillsPrompt } from './prompts/math_integrating_essential_skills';
import { buildModelingMathPrompt } from './prompts/math_modeling';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'https://ollama.com';
const DEFAULT_MODEL = 'deepseek-v3.1:671b-cloud';

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

async function chat(content: string): Promise<string> {
  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  if (!apiKey) throw new Error('OLLAMA_API_KEY is not set');

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama Cloud ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as ChatResponse;
  return data.choices?.[0]?.message?.content ?? '';
}

// Tolerantly extract a JSON value from a model response (strips ``` fences,
// optional leading prose). Returns the parsed JSON value or throws.
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let raw = (fenced ? fenced[1] : trimmed).trim();
  // If the model added leading prose before the JSON, scrape from the first { or [.
  if (raw.length && raw[0] !== '{' && raw[0] !== '[') {
    const i = Math.min(
      ...['{', '['].map((c) => {
        const ix = raw.indexOf(c);
        return ix === -1 ? Infinity : ix;
      }),
    );
    if (i !== Infinity) raw = raw.slice(i);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`extractJson: invalid JSON from model: ${raw.slice(0, 200)}`);
  }
}

export class OllamaCloudProvider implements AIProvider {
  async generatePassage(
    passageType: PassageType,
    difficulty: Difficulty,
  ): Promise<PassageCandidate> {
    const prompt = passagePromptBuilders[passageType](difficulty);
    const content = await chat(prompt);
    const parsed = extractJson(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(
        `generatePassage(${passageType}): expected a JSON object, got ${typeof parsed}`,
      );
    }
    // Backfill passage_type if the model omitted it — the prompt explicitly asks
    // for it but defensive backfill keeps the zod validation from rejecting an
    // otherwise-valid response.
    const obj = parsed as Record<string, unknown>;
    if (!('passage_type' in obj)) {
      obj.passage_type = passageType;
    }
    return obj as PassageCandidate;
  }

  async generateQuestionsForPassage(input: {
    passageType: PassageType;
    passageBody: string;
    passageStimuli?: Stimulus[];
    difficulty: Difficulty;
  }): Promise<QuestionCandidate[]> {
    const builder = questionsPromptBuilders[input.passageType];
    const prompt = builder(
      input.passageBody,
      input.difficulty,
      input.passageStimuli,
    );
    const content = await chat(prompt);
    const parsed = extractJson(content);
    if (!Array.isArray(parsed)) {
      throw new Error(
        `generateQuestionsForPassage(${input.passageType}): expected a JSON array`,
      );
    }
    return parsed as QuestionCandidate[];
  }

  async generateMathStandalone(
    skill: string,
    count: number,
    difficulty: Difficulty,
  ): Promise<QuestionCandidate[]> {
    const builder = mathPromptBuilders[skill];
    if (!builder) {
      throw new Error(`generateMathStandalone: unknown skill "${skill}"`);
    }
    const prompt = builder(count, difficulty);
    const content = await chat(prompt);
    const parsed = extractJson(content);
    if (!Array.isArray(parsed)) {
      throw new Error(
        `generateMathStandalone(${skill}): expected a JSON array`,
      );
    }
    return parsed as QuestionCandidate[];
  }

  async solveQuestion(input: {
    stem: string;
    choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
    passageBody?: string;
    passageStimuli?: Stimulus[];
  }): Promise<'A' | 'B' | 'C' | 'D'> {
    const stimuliBlock = input.passageStimuli && input.passageStimuli.length
      ? `Stimuli (JSON):\n${JSON.stringify(input.passageStimuli)}\n`
      : '';
    const passageBlock = input.passageBody
      ? `Passage:\n"""\n${input.passageBody}\n"""\n`
      : '';
    const content = await chat(
      `Solve this ACT question. Respond with ONLY the single letter A, B, C, or D — nothing else.\n` +
        passageBlock +
        stimuliBlock +
        `Question: ${input.stem}\n` +
        input.choices.map((c) => `${c.key}: ${c.text}`).join('\n'),
    );
    const trimmed = content.trim();
    const m = trimmed.match(/^[ABCD]$/) ?? trimmed.match(/\b[ABCD]\b/);
    if (!m) {
      throw new Error(`solveQuestion: no A-D in response: ${trimmed.slice(0, 80)}`);
    }
    return m[0] as 'A' | 'B' | 'C' | 'D';
  }

  // Multi-validity check (MCQ): asks the model to evaluate EACH of the 4
  // choices independently and report the 0-based indices of every choice it
  // considers a valid correct answer. Mirrors SAT's findValidChoices, adapted
  // for ACT's A/B/C/D keyed choices. Used by generate.ts after the
  // single-answer self-verify passes; a candidate with more than one valid
  // index is rejected.
  async findValidChoices(input: {
    stem: string;
    choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
    passageBody?: string;
    passageStimuli?: Stimulus[];
  }): Promise<number[]> {
    const stimuliBlock = input.passageStimuli && input.passageStimuli.length
      ? `Stimuli (JSON):\n${JSON.stringify(input.passageStimuli)}\n`
      : '';
    const passageBlock = input.passageBody
      ? `Passage:\n"""\n${input.passageBody}\n"""\n`
      : '';
    const content = await chat(
      `For the ACT question below, evaluate EACH of the 4 choices ` +
        `independently and decide whether it is a valid correct answer. ` +
        `A valid answer satisfies the question completely; do NOT include ` +
        `choices that are merely plausible distractors. For math equations ` +
        `with multiple roots (e.g. quadratics where both roots appear), ` +
        `every actual root that appears in the list counts as valid.\n\n` +
        `Respond with ONLY a JSON array of 0-based indices, e.g. [0] for one ` +
        `valid choice, or [0,2] if two are valid. The indices map A=0, B=1, ` +
        `C=2, D=3. No prose, no markdown, no other text.\n\n` +
        passageBlock +
        stimuliBlock +
        `Question: ${input.stem}\n` +
        input.choices.map((c, i) => `${i}: ${c.key}: ${c.text}`).join('\n'),
    );
    // Tolerant extraction: look for the first JSON-array-of-ints in the
    // response. Falls back to scraping individual 0-3 digits if the model
    // returned an unfenced list like "0, 2".
    const raw = content.trim();
    let arr: number[] | null = null;
    const fenced = raw.match(/\[\s*(?:[0-3]\s*,\s*)*[0-3]?\s*\]/);
    if (fenced) {
      try {
        const parsed = JSON.parse(fenced[0]);
        if (Array.isArray(parsed)) {
          arr = parsed.filter(
            (n) => Number.isInteger(n) && n >= 0 && n <= 3,
          );
        }
      } catch {
        /* fall through */
      }
    }
    if (arr === null) {
      const found = new Set<number>();
      for (const m2 of raw.matchAll(/\b[0-3]\b/g)) {
        found.add(Number.parseInt(m2[0], 10));
      }
      arr = [...found];
    }
    arr.sort((a, b) => a - b);
    return arr;
  }
}

const passagePromptBuilders: Record<
  PassageType,
  (difficulty: Difficulty) => string
> = {
  english_essay: buildEnglishEssayPassage,
  literary_narrative: buildReadingLiteraryNarrativePassage,
  social_science: buildReadingSocialSciencePassage,
  humanities: buildReadingHumanitiesPassage,
  natural_science: buildReadingNaturalSciencePassage,
  data_representation: buildScienceDataRepresentationPassage,
  research_summaries: buildScienceResearchSummariesPassage,
  conflicting_viewpoints: buildScienceConflictingViewpointsPassage,
};

const questionsPromptBuilders: Record<
  PassageType,
  (body: string, difficulty: Difficulty, stimuli?: Stimulus[]) => string
> = {
  english_essay: (body, d) => buildEnglishEssayQuestionsPrompt(body, d),
  literary_narrative: (body, d) =>
    buildReadingLiteraryNarrativeQuestionsPrompt(body, d),
  social_science: (body, d) => buildReadingSocialScienceQuestionsPrompt(body, d),
  humanities: (body, d) => buildReadingHumanitiesQuestionsPrompt(body, d),
  natural_science: (body, d) =>
    buildReadingNaturalScienceQuestionsPrompt(body, d),
  data_representation: (body, d, stim) =>
    buildScienceDataRepresentationQuestionsPrompt(body, d, stim),
  research_summaries: (body, d, stim) =>
    buildScienceResearchSummariesQuestionsPrompt(body, d, stim),
  conflicting_viewpoints: (body, d, stim) =>
    buildScienceConflictingViewpointsQuestionsPrompt(body, d, stim),
};

const mathPromptBuilders: Record<
  string,
  (count: number, difficulty: Difficulty) => string
> = {
  preparing_for_higher_math: buildPreparingForHigherMathPrompt,
  integrating_essential_skills: buildIntegratingEssentialSkillsPrompt,
  modeling: buildModelingMathPrompt,
};
