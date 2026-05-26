'use client';

import { Button } from '@/app/components/ui/button';
import type { AttemptQuestion } from '@/app/lib/persistence/schema';
import type { Choice, ResponseState } from '@/app/hooks/useTestSession';

interface Props {
  question: AttemptQuestion;
  index: number;
  total: number;
  response: ResponseState;
  onSelect: (choice: Choice) => void;
  onClear: () => void;
  onToggleFlag: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const CHOICE_LETTERS: Choice[] = ['A', 'B', 'C', 'D'];

export function QuestionPane({
  question,
  index,
  total,
  response,
  onSelect,
  onClear,
  onToggleFlag,
  onNext,
  onPrev,
}: Props) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">
          Question {index + 1} of {total}
        </div>
        <button
          type="button"
          onClick={onToggleFlag}
          className={`rounded-md border px-2 py-1 text-xs transition ${
            response.flagged
              ? 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
          aria-pressed={response.flagged}
        >
          {response.flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>

      <div className="mb-4 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
        {question.stem}
      </div>

      <fieldset className="mb-4 space-y-2">
        <legend className="sr-only">Answer choices</legend>
        {choices.map((text, i) => {
          const letter = CHOICE_LETTERS[i];
          if (!letter) return null;
          const selected = response.selected === letter;
          return (
            <label
              key={letter}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`q-${question.question_id}`}
                className="mt-1 h-4 w-4"
                checked={selected}
                onChange={() => onSelect(letter)}
              />
              <span className="text-sm">
                <span className="mr-2 inline-block w-5 font-semibold text-slate-700">
                  {letter}.
                </span>
                <span className="text-slate-800">{text}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="outline" onClick={onPrev} disabled={!onPrev || index === 0}>
          Previous
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-700"
          disabled={response.selected == null}
        >
          Clear
        </button>
        <Button
          variant="outline"
          onClick={onNext}
          disabled={!onNext || index === total - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
