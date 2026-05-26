'use client';

import { Button } from '@/app/components/ui/button';
import type { ResponseState } from '@/app/hooks/useTestSession';
import type { AttemptQuestion } from '@/app/lib/persistence/schema';

interface Props {
  questions: AttemptQuestion[];
  responses: ResponseState[];
  onGoTo: (idx: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

// Inline review panel — shows flagged + unanswered questions. Click any
// item to jump back to it.
export function ReviewView({
  questions,
  responses,
  onGoTo,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const flagged: number[] = [];
  const unanswered: number[] = [];
  responses.forEach((r, i) => {
    if (r.flagged) flagged.push(i);
    if (r.selected == null) unanswered.push(i);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Review</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to test
        </Button>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Flagged ({flagged.length})
        </h3>
        {flagged.length === 0 ? (
          <p className="text-sm text-slate-500">No flagged questions.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {flagged.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => onGoTo(i)}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
              >
                Q{i + 1}
                {responses[i]?.selected ? ` · ${responses[i]?.selected}` : ' · —'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Unanswered ({unanswered.length})
        </h3>
        {unanswered.length === 0 ? (
          <p className="text-sm text-slate-500">All questions answered.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unanswered.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => onGoTo(i)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Q{i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          All questions ({questions.length})
        </h3>
        <div className="grid grid-cols-10 gap-1.5">
          {responses.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGoTo(i)}
              className={`relative h-8 rounded-md border text-xs ${
                r.selected
                  ? 'border-blue-300 bg-blue-100 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {i + 1}
              {r.flagged && (
                <span className="absolute right-0 top-0 -mt-0.5 -mr-0.5 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit section'}
        </Button>
      </div>
    </div>
  );
}
