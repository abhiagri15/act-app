import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { FinalResults } from '@/app/lib/persistence/schema';

interface Props {
  results: FinalResults;
}

const SECTION_LABELS: Record<string, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

const SECTION_ORDER = ['english', 'math', 'reading', 'science'] as const;

// Server component. Renders composite + per-section scaled breakdown.
export function ResultsScreen({ results }: Props) {
  const sections = SECTION_ORDER.filter((s) =>
    s === 'science' ? results.include_science : true,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Your composite score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-center">
            <div className="text-7xl font-bold text-blue-600">
              {results.composite ?? '—'}
            </div>
            <div className="mt-1 text-sm text-slate-500">of 36</div>
          </div>

          <h3 className="mb-2 text-sm font-medium text-slate-700">Section scaled scores</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sections.map((s) => {
              const scaled = results.scaled_scores[s];
              const raw = results.raw_scores[s];
              return (
                <div
                  key={s}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-center"
                >
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {SECTION_LABELS[s]}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-800">
                    {scaled ?? '—'}
                  </div>
                  {raw !== undefined && (
                    <div className="text-xs text-slate-500">
                      raw {raw}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-xs italic text-slate-500">
            Scores are estimates based on a linear scale; treat them as a relative
            indicator of progress, not a transcript-grade score.
          </p>

          <div className="mt-6 flex gap-2">
            <Link href={`/dashboard/attempts/${results.attempt_id}`}>
              <Button>Review this test</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Return to dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
