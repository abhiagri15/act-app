import type { AttemptSnapshot } from '@/app/lib/persistence/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

const SECTION_LABELS: Record<string, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

const SECTION_ORDER = ['english', 'math', 'reading', 'science'] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AttemptSummary({ snapshot }: { snapshot: AttemptSnapshot }) {
  const sections = SECTION_ORDER.filter((s) =>
    s === 'science' ? snapshot.include_science : true,
  );

  // Enhanced ACT: STEM = mean of Math + Science (only when Science was taken).
  const mathScaled = snapshot.scaled_scores['math'];
  const scienceScaled = snapshot.scaled_scores['science'];
  const stem =
    snapshot.include_science &&
    typeof mathScaled === 'number' &&
    typeof scienceScaled === 'number'
      ? Math.round((mathScaled + scienceScaled) / 2)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attempt summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase text-slate-500">Composite</div>
            <div className="text-5xl font-bold text-blue-600">
              {snapshot.composite ?? '—'}
              <span className="ml-1 text-xs text-slate-400">/ 36</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              avg of English, Reading &amp; Math
            </div>
            {stem !== null && (
              <div className="mt-1 text-xs text-slate-600">
                STEM <span className="font-semibold text-slate-800">{stem}</span>
                <span className="text-slate-400"> / 36 · Math + Science</span>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Started: {formatDate(snapshot.started_at)}</div>
            {snapshot.submitted_at && (
              <div>Submitted: {formatDate(snapshot.submitted_at)}</div>
            )}
            <div className="mt-1">
              Status: <span className="font-semibold">{snapshot.status}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sections.map((s) => {
            const scaled = snapshot.scaled_scores[s];
            const raw = snapshot.raw_scores[s];
            return (
              <div
                key={s}
                className="rounded-md border border-slate-200 bg-slate-50 p-2 text-center"
              >
                <div className="text-xs uppercase text-slate-500">
                  {SECTION_LABELS[s]}
                </div>
                <div className="text-2xl font-semibold text-slate-800">{scaled ?? '—'}</div>
                {raw !== undefined && (
                  <div className="text-xs text-slate-500">raw {raw}</div>
                )}
                {s === 'science' && (
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-600">
                    not in composite
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
