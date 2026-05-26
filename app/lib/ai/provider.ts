import type { PassageType } from '@/app/lib/act/format';
import type { PassageCandidate, QuestionCandidate } from './schema';
import { OllamaCloudProvider } from './ollama';

export type Stimulus = {
  kind: 'table' | 'figure';
  caption: string;
  data: unknown;
};

export interface AIProvider {
  // Generate one passage of the given type. Caller inserts into act.passages
  // and then calls generateQuestionsForPassage with the resulting body.
  generatePassage(passageType: PassageType): Promise<PassageCandidate>;

  // Generate exactly PASSAGE_QUESTION_COUNTS[passageType] questions targeting
  // a freshly-inserted passage.
  generateQuestionsForPassage(input: {
    passageType: PassageType;
    passageBody: string;
    passageStimuli?: Stimulus[];
  }): Promise<QuestionCandidate[]>;

  // Generate `count` standalone Math questions for the given skill.
  generateMathStandalone(
    skill: string,
    count: number,
  ): Promise<QuestionCandidate[]>;

  // Re-solve a question for self-verify. Returns the model's independent
  // A/B/C/D answer; if it disagrees with the candidate's answer_key, the
  // candidate is rejected by the caller.
  solveQuestion(input: {
    stem: string;
    choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
    passageBody?: string;
    passageStimuli?: Stimulus[];
  }): Promise<'A' | 'B' | 'C' | 'D'>;
}

// Provider factory — keyed on ACT_AI_PROVIDER so other providers can be added later.
export function getProvider(): AIProvider {
  const name = process.env.ACT_AI_PROVIDER ?? 'ollama-cloud';
  switch (name) {
    case 'ollama-cloud':
      return new OllamaCloudProvider();
    default:
      throw new Error(`Unknown ACT_AI_PROVIDER: ${name}`);
  }
}
