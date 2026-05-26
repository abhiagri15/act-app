import { type ActSection, SECTION_ORDER } from '@/app/lib/act/format';
import {
  accuracyPct,
  sortSkillsWeakestFirst,
  type SkillStat,
} from '@/app/lib/analytics/compute';

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

// Render the skill taxonomy id as a human label: snake_case -> Title Case.
function humanizeSkill(skill: string): string {
  return skill
    .split('_')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// Per-skill accuracy bars, grouped by section header, weakest-first within
// each section, color-graded green/amber/red.
export function SkillAccuracy({ skills }: { skills: SkillStat[] }) {
  return (
    <div className="space-y-6">
      {SECTION_ORDER.map((section) => {
        const rows = sortSkillsWeakestFirst(
          skills.filter((s) => s.section === section),
        );
        if (rows.length === 0) return null;
        return (
          <div key={section}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              {SECTION_LABELS[section]}
            </h3>
            <div className="space-y-2">
              {rows.map((s) => {
                const pct = accuracyPct(s.correct, s.total);
                return (
                  <div key={s.skill}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{humanizeSkill(s.skill)}</span>
                      <span>
                        {s.correct}/{s.total} · {pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${barColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
