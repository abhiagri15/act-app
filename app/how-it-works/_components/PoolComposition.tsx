// app/how-it-works/_components/PoolComposition.tsx
//
// Live pool counts per section vs target. Stats are fetched once in
// app/how-it-works/page.tsx (server component) and passed in as props so we
// only hit the DB once per render.

import type { PublicPoolStats } from '@/app/lib/marketing/queries';

interface PoolCompositionProps {
  stats: PublicPoolStats | null;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function pct(count: number, target: number | null): string {
  if (!target) return '—';
  const p = Math.min(100, Math.round((count / target) * 100));
  return `${p}%`;
}

export function PoolComposition({ stats }: PoolCompositionProps) {
  return (
    <section id="pool" className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900">Live pool</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          What&apos;s in the pool right now. New sessions draw from this. The
          n8n generator runs hourly to keep counts moving toward target.
        </p>

        {stats ? (
          <>
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Section</th>
                    <th className="px-4 py-2 text-right">Questions</th>
                    <th className="px-4 py-2 text-right">Target</th>
                    <th className="px-4 py-2 text-right">Passages</th>
                    <th className="px-4 py-2 text-right">Target</th>
                    <th className="px-4 py-2 text-right">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sections.map((s) => (
                    <tr key={s.section} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-900">{s.label}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                        {s.questions}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">
                        {s.questionsTarget ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                        {s.passages || (s.section === 'math' ? '—' : 0)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">
                        {s.passagesTarget ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-500">
                        {pct(s.questions, s.questionsTarget)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-2 text-xs uppercase tracking-wide text-slate-500">Total</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">
                      {stats.totalQuestions}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">600</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">
                      {stats.totalPassages}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">56</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Most recent question added: {formatTimestamp(stats.lastRefreshed)}.
              {' '}Counts include enabled rows only &mdash; questions that have
              been disabled by moderation are excluded.
            </p>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">
            Pool stats temporarily unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
