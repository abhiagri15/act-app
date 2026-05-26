import type { AnalyticsView } from '@/app/lib/analytics/compute';
import { summarize } from '@/app/lib/analytics/compute';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n == null) return '—';
  // Composite is rendered as integer for tests taken/best/latest;
  // avg may be a decimal (the RPC rounds to 1 dp). Trim trailing .0.
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

// Four summary cards across the top of /analytics. Renders an empty-state
// row when no tests have been taken.
export function SummaryStats({ view }: { view: AnalyticsView }) {
  const s = summarize(view);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Tests taken" value={String(s.testsTaken)} />
      <Card label="Latest composite" value={fmt(s.latest)} />
      <Card label="Average composite" value={fmt(s.avg)} />
      <Card label="Best composite" value={fmt(s.best)} />
    </div>
  );
}
