// app/how-it-works/_components/QuestionPipeline.tsx
//
// Methodology section. CSS-only "flow diagram" of the n8n hourly generator
// pipeline. Model names match the live ACT Config Provider workflow
// (ghVKwVwYjB7T2vPY) — keep this in sync if model assignments change.

const STAGES = [
  'Generate',
  'Schema validate',
  'Self-verify (cross-model)',
  'Tiebreak (2-of-3 vote)',
  'Multi-validity check',
  'Letter-ref cleanup',
  'Dedup',
  'Insert into pool',
];

export function QuestionPipeline() {
  return (
    <section id="methodology" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-2xl font-bold text-slate-900">How questions are made</h2>

      <div className="mt-6 space-y-4 text-slate-700">
        <p>
          Every question on this site is AI-generated. We&apos;re upfront about
          that, and we put a multi-stage quality gate in front of the pool so
          that bad candidates don&apos;t make it in front of you.
        </p>
        <p>
          The generator pipeline runs in n8n every hour. Three different models
          have to agree on the right answer before a question is accepted:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
          <li>
            <span className="font-semibold">Generator</span> &mdash; DeepSeek v4-pro
            produces a candidate question with its claimed answer.
          </li>
          <li>
            <span className="font-semibold">Solver</span> &mdash; Gemini
            3-flash-preview re-solves the same question from scratch. If it
            agrees with the generator, the candidate proceeds.
          </li>
          <li>
            <span className="font-semibold">Tiebreaker</span> &mdash; If the
            first two disagree, Gemma 4 casts a third vote. A 2-of-3 majority
            wins; ties are dropped.
          </li>
        </ul>
        <p>
          Cross-provider diversity is the point. Three calls to the same model
          would share the same blind spots; DeepSeek + Gemini + Gemma have
          independent ones, which catches more bad questions.
        </p>
        <p>
          Surviving candidates then pass through a{' '}
          <span className="font-semibold">multi-validity check</span> (does any
          other choice also work as an answer?), a{' '}
          <span className="font-semibold">letter-reference cleanup</span> pass
          on the explanation (so &ldquo;Choice A is correct&rdquo; doesn&apos;t
          break when choices get shuffled at runtime), per-difficulty
          calibration, and a SHA-256 dedup check before insert.
        </p>
        <p>
          A Vercel cron job also runs a single-model daily backup, so the pool
          continues to grow even if the hourly n8n job is paused.
        </p>
        <p className="text-sm text-slate-500">
          Honest caveat: the three-model vote catches a lot, but it&apos;s not
          equivalent to professional psychometric authoring. If you spot a bad
          question, flag it on the review page &mdash; an admin triages every
          flag.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center">
            <span className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-blue-200">
              {s}
            </span>
            {i < STAGES.length - 1 && (
              <span aria-hidden className="mx-1 text-slate-300">&rarr;</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
