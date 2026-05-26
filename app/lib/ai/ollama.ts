// Placeholder. Real implementation lands in Task 3.
import type { AIProvider, Stimulus } from './provider';
import type { PassageCandidate, QuestionCandidate } from './schema';
import type { PassageType } from '@/app/lib/act/format';

export class OllamaCloudProvider implements AIProvider {
  async generatePassage(_passageType: PassageType): Promise<PassageCandidate> {
    throw new Error('OllamaCloudProvider.generatePassage not yet implemented');
  }
  async generateQuestionsForPassage(_input: {
    passageType: PassageType;
    passageBody: string;
    passageStimuli?: Stimulus[];
  }): Promise<QuestionCandidate[]> {
    throw new Error(
      'OllamaCloudProvider.generateQuestionsForPassage not yet implemented',
    );
  }
  async generateMathStandalone(
    _skill: string,
    _count: number,
  ): Promise<QuestionCandidate[]> {
    throw new Error(
      'OllamaCloudProvider.generateMathStandalone not yet implemented',
    );
  }
  async solveQuestion(_input: {
    stem: string;
    choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
    passageBody?: string;
    passageStimuli?: Stimulus[];
  }): Promise<'A' | 'B' | 'C' | 'D'> {
    throw new Error('OllamaCloudProvider.solveQuestion not yet implemented');
  }
}
