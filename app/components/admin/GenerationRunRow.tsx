import type { AdminGenerationRun } from '@/app/lib/admin/queries';

function formatTime(ts: string | null): string {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleString();
}

function durationMs(run: AdminGenerationRun): string {
  if (!run.finished_at) return 'in progress';
  const start = new Date(run.started_at).getTime();
  const end = new Date(run.finished_at).getTime();
  const sec = Math.max(0, Math.round((end - start) / 1000));
  return `${sec}s`;
}

function errorsCount(run: AdminGenerationRun): number {
  if (Array.isArray(run.errors)) return run.errors.length;
  return 0;
}

// One row of act.generation_runs on /admin/generation.
export function GenerationRunRow({ run }: { run: AdminGenerationRun }) {
  const eCount = errorsCount(run);
  const errorsText =
    eCount === 0
      ? 'no errors'
      : `${eCount} error${eCount === 1 ? '' : 's'}`;
  const errorsTitle =
    eCount === 0 ? undefined : JSON.stringify(run.errors, null, 2);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-slate-500">{formatTime(run.started_at)}</span>
        {run.skill ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {run.skill}
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            no skill tag
          </span>
        )}
        <span className="text-slate-500">
          target {run.target ?? '—'} · produced {run.produced} · {durationMs(run)}
        </span>
        <span
          title={errorsTitle}
          className={`rounded-full px-2 py-0.5 font-medium ${
            eCount === 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {errorsText}
        </span>
      </div>
    </div>
  );
}
