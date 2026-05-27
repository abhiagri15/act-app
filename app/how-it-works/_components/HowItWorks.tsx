// app/how-it-works/_components/HowItWorks.tsx
//
// Step-by-step walk-through of a single Enhanced ACT attempt. Numbers come
// from app/lib/act/format.ts (single source of truth) so this stays in sync
// with the runner if the section counts ever change.

import {
  SECTION_QUESTION_COUNTS,
  SECTION_DURATIONS_SEC,
  BREAK_DURATION_SEC,
} from '@/app/lib/act/format';

const fmtMin = (sec: number) => `${Math.round(sec / 60)} min`;

const STEPS = [
  {
    n: 1,
    title: 'Pre-test',
    body: 'Pick whether to include the optional Science section. Enhanced ACT lets you opt out — your composite is then averaged over three sections instead of four.',
  },
  {
    n: 2,
    title: 'English',
    body: `${SECTION_QUESTION_COUNTS.english} questions in ${fmtMin(SECTION_DURATIONS_SEC.english)}. Passage-based with inline [[N]] markers — answer in-place as you read.`,
  },
  {
    n: 3,
    title: 'Math',
    body: `${SECTION_QUESTION_COUNTS.math} standalone questions in ${fmtMin(SECTION_DURATIONS_SEC.math)}. All multiple choice. Built-in Desmos scientific calculator overlay.`,
  },
  {
    n: 4,
    title: 'Break',
    body: `${fmtMin(BREAK_DURATION_SEC)} mandatory break between Math and Reading. Countdown runs; you can hit "Resume Reading early" once you're ready.`,
  },
  {
    n: 5,
    title: 'Reading',
    body: `${SECTION_QUESTION_COUNTS.reading} questions in ${fmtMin(SECTION_DURATIONS_SEC.reading)}. Resizable two-pane layout: passage on one side, questions on the other.`,
  },
  {
    n: 6,
    title: 'Science (optional)',
    body: `${SECTION_QUESTION_COUNTS.science} questions in ${fmtMin(SECTION_DURATIONS_SEC.science)}. Two-pane with embedded tables and figures rendered as inline SVG.`,
  },
  {
    n: 7,
    title: 'Results',
    body: 'Per-section scaled score (1–36), composite (1–36), and a per-question review with explanations. Flag anything that looks off.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-2xl font-bold text-slate-900">How a test runs</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Each attempt is a fixed sequence of sections with strict, section-locked
        timers. You can&apos;t go back to a section once it submits.
      </p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg border border-slate-200 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {s.n}
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
