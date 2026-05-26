import { type ActSection, SECTION_ORDER } from '@/app/lib/act/format';
import { accuracyPct, type AnalyticsView } from '@/app/lib/analytics/compute';

const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

function barColor(pct: number): string {
  if (pct < 60) return 'bg-red-500';
  if (pct < 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// Horizontal accuracy bars, one row per section, color-graded.
// Sections with zero answered questions are skipped (e.g. Science when the
// user has never opted in).
export function SectionAccuracy({ sections }: { sections: AnalyticsView['sections'] }) {
  const rows = SECTION_ORDER.map((section) => ({
    section,
    stat: sections[section],
  })).filter((r) => r.stat && r.stat.total > 0);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map(({ section, stat }) => {
        const pct = accuracyPct(stat!.correct, stat!.total);
        return (
          <div key={section}>
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-medium text-slate-700">
                {SECTION_LABELS[section]}
              </span>
              <span>
                {stat!.correct}/{stat!.total} · {pct}%
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${barColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
