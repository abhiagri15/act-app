// app/how-it-works/_components/Parity.tsx
//
// Side-by-side comparison of the real Enhanced ACT (2025+) and this app.
// Verdicts are pulled from
// docs/superpowers/analysis/2026-05-26-real-test-fidelity-comparison.md.

const ROWS: Array<{ feature: string; real: string; app: string; verdict: string }> = [
  {
    feature: 'Section count',
    real: '4 sections: English, Math, Reading, Science',
    app: 'Same 4 sections, same order',
    verdict: 'Match',
  },
  {
    feature: 'Question counts',
    real: '50 / 45 / 36 / 40',
    app: '50 / 45 / 36 / 40',
    verdict: 'Match',
  },
  {
    feature: 'Section durations',
    real: '35 / 50 / 40 / 40 min',
    app: '35 / 50 / 40 / 40 min',
    verdict: 'Match',
  },
  {
    feature: 'Mid-test break',
    real: '10 min after Math',
    app: '10 min after Math, with "Resume Reading early"',
    verdict: 'Match',
  },
  {
    feature: 'Section-locked timers',
    real: 'Yes — cannot return to a finished section',
    app: 'Yes, server-truth ends_at — force-locks at deadline',
    verdict: 'Match',
  },
  {
    feature: 'Optional Science',
    real: 'Yes (Enhanced ACT, 2025+)',
    app: 'Toggle on the pre-test screen',
    verdict: 'Match',
  },
  {
    feature: 'Math question format',
    real: 'All multiple choice (4 options)',
    app: 'All MCQ, A–D',
    verdict: 'Match',
  },
  {
    feature: 'Calculator on Math',
    real: 'Any calculator permitted',
    app: 'Built-in Desmos scientific overlay',
    verdict: 'Match',
  },
  {
    feature: 'Math reference sheet',
    real: 'Not provided',
    app: 'Not provided (correct)',
    verdict: 'Match',
  },
  {
    feature: 'Composite scoring',
    real: '1–36, average of included section scaled scores',
    app: 'Same formula',
    verdict: 'Match',
  },
  {
    feature: 'Per-section scaled scoring',
    real: '1–36, published curves',
    app: 'Rescaled published Classic ACT curve (per-form variation ±1–2 points)',
    verdict: 'Close (approximate)',
  },
  {
    feature: 'Authoring source',
    real: 'ACT, Inc. psychometric authoring',
    app: 'AI-generated, 3-model vote (see methodology below)',
    verdict: 'Different (disclosed)',
  },
];

export function Parity() {
  return (
    <section id="why-its-close" className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900">Why it&apos;s close to the real Enhanced ACT</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Section structure, timing, calculator policy, and scoring scale mirror
          the real Enhanced ACT. Authoring is the part that differs &mdash; and
          we&apos;re explicit about how it works in the next section.
        </p>

        <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Feature</th>
                <th className="px-4 py-2 text-left">Real Enhanced ACT</th>
                <th className="px-4 py-2 text-left">This app</th>
                <th className="px-4 py-2 text-left">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.feature} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 font-medium text-slate-900">{r.feature}</td>
                  <td className="px-4 py-2 text-slate-700">{r.real}</td>
                  <td className="px-4 py-2 text-slate-700">{r.app}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.verdict === 'Match'
                          ? 'rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200'
                          : r.verdict === 'Close (approximate)'
                            ? 'rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200'
                            : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200'
                      }
                    >
                      {r.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
