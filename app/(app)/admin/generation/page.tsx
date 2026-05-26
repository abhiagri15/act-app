import Link from 'next/link';
import { listGenerationRuns } from '@/app/lib/admin/queries';
import { GenerationRunRow } from '@/app/components/admin/GenerationRunRow';

export default async function AdminGenerationPage() {
  const runs = await listGenerationRuns(50);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Generation log</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        Last {runs.length} run{runs.length === 1 ? '' : 's'} from the n8n
        workflow and the Vercel cron. Hover the errors badge to see details.
      </p>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No generation runs have been recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <GenerationRunRow key={r.id} run={r} />
          ))}
        </div>
      )}
    </main>
  );
}
