'use client';

import type { ResponseState } from '@/app/hooks/useTestSession';

interface Props {
  responses: ResponseState[];
  currentIndex: number;
  onSelect: (idx: number) => void;
}

// Grid of question cells across the bottom of the section runner.
// Color-coded: empty (gray) / answered (blue) / flagged (amber corner) / current (ring).
export function NumberPalette({ responses, currentIndex, onSelect }: Props) {
  return (
    <div className="border-t bg-white p-3">
      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15">
        {responses.map((r, idx) => {
          const isCurrent = idx === currentIndex;
          const answered = r.selected != null;
          const flagged = r.flagged;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={`relative h-9 rounded-md border text-xs font-medium transition ${
                isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''
              } ${
                answered
                  ? 'border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title={`Question ${idx + 1}${answered ? ' (answered)' : ''}${
                flagged ? ' (flagged)' : ''
              }`}
            >
              {idx + 1}
              {flagged && (
                <span
                  className="absolute right-0 top-0 -mt-0.5 -mr-0.5 h-2 w-2 rounded-full bg-amber-500"
                  aria-label="flagged"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
