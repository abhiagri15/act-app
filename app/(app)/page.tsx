import Link from 'next/link';
import { listMyAttempts } from '@/app/lib/persistence/queries';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { AttemptListItem } from '@/app/lib/persistence/schema';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AttemptRow({ attempt }: { attempt: AttemptListItem }) {
  const isInProgress = attempt.status === 'in_progress';
  const href = isInProgress
    ? `/test/${attempt.id}`
    : `/dashboard/attempts/${attempt.id}`;
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{formatDate(attempt.started_at)}</div>
          <div className="mt-1 flex gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {attempt.include_science ? 'Full (with Science)' : 'No Science'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                attempt.status === 'submitted'
                  ? 'bg-green-100 text-green-700'
                  : attempt.status === 'in_progress'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {attempt.status === 'in_progress'
                ? 'In progress'
                : attempt.status === 'submitted'
                  ? 'Submitted'
                  : 'Abandoned'}
            </span>
          </div>
        </div>
        <div className="text-right">
          {attempt.composite != null ? (
            <>
              <div className="text-2xl font-bold text-blue-600">{attempt.composite}</div>
              <div className="text-xs text-slate-500">of 36</div>
            </>
          ) : (
            <div className="text-sm text-slate-400">—</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const attempts = await listMyAttempts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Start a Full Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            Run the full Enhanced ACT under timed conditions: English, Math, a 10-minute
            break, Reading, and (optionally) Science. Composite score 1–36.
          </p>
          <Link href="/test/new">
            <Button>Begin practice test</Button>
          </Link>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-700">Your attempts</h2>
      {attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          You haven&apos;t taken a test yet. Click &quot;Begin practice test&quot; above to start.
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => (
            <AttemptRow key={a.id} attempt={a} />
          ))}
        </div>
      )}
    </div>
  );
}
