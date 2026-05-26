import type { AIProvider, Stimulus } from './provider';
import type { PassageCandidate, QuestionCandidate } from './schema';
import type { PassageType } from '@/app/lib/act/format';

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
  async generatePassage(passageType: PassageType): Promise<PassageCandidate> {
    const prompt = passagePromptBuilders[passageType]();
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
  }): Promise<QuestionCandidate[]> {
    const builder = questionsPromptBuilders[input.passageType];
    const prompt = builder(input.passageBody, input.passageStimuli);
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
  ): Promise<QuestionCandidate[]> {
    const builder = mathPromptBuilders[skill];
    if (!builder) {
      throw new Error(`generateMathStandalone: unknown skill "${skill}"`);
    }
    const prompt = builder(count);
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
}

const passagePromptBuilders: Record<PassageType, () => string> = {
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
  (body: string, stimuli?: Stimulus[]) => string
> = {
  english_essay: (body) => buildEnglishEssayQuestionsPrompt(body),
  literary_narrative: (body) => buildReadingLiteraryNarrativeQuestionsPrompt(body),
  social_science: (body) => buildReadingSocialScienceQuestionsPrompt(body),
  humanities: (body) => buildReadingHumanitiesQuestionsPrompt(body),
  natural_science: (body) => buildReadingNaturalScienceQuestionsPrompt(body),
  data_representation: (body, stim) =>
    buildScienceDataRepresentationQuestionsPrompt(body, stim),
  research_summaries: (body, stim) =>
    buildScienceResearchSummariesQuestionsPrompt(body, stim),
  conflicting_viewpoints: (body, stim) =>
    buildScienceConflictingViewpointsQuestionsPrompt(body, stim),
};

const mathPromptBuilders: Record<string, (count: number) => string> = {
  preparing_for_higher_math: buildPreparingForHigherMathPrompt,
  integrating_essential_skills: buildIntegratingEssentialSkillsPrompt,
  modeling: buildModelingMathPrompt,
};
