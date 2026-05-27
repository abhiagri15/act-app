'use client';

import { useState } from 'react';
import { CalculatorPanel } from './CalculatorPanel';

// Single-pane Math runner. Centered column with stem + 4 choices.
// No passage, no stimuli.
//
// Also hosts the floating Desmos scientific calculator overlay (Math-only on
// the real ACT, mirrors SAT's CalculatorPanel pattern). State is scoped to
// this component so section transitions (English/Reading/Science) unmount the
// runner and the panel disappears automatically — no explicit cleanup needed.
export function MathRunner({ questionPane }: { questionPane: React.ReactNode }) {
  const [calcOpen, setCalcOpen] = useState(false);
  return (
    <div className="relative h-full">
      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-y-auto px-4 py-3 sm:px-6">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setCalcOpen((v) => !v)}
            aria-pressed={calcOpen}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            {calcOpen ? 'Hide calculator' : 'Calculator'}
          </button>
        </div>
        <div className="flex-1">{questionPane}</div>
      </div>
      {calcOpen && <CalculatorPanel onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
