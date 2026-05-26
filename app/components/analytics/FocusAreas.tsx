import { type ActSection } from '@/app/lib/act/format';
import {
  accuracyPct,
  focusAreas,
  type AnalyticsView,
} from '@/app/lib/analytics/compute';

const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

function humanizeSkill(skill: string): string {
  return skill
    .split('_')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// Card with the 3 weakest skills (≥ 5 attempts). Renders nothing when
// no skill qualifies — keeps the page from showing an empty "Focus areas"
// header right after the very first attempt.
export function FocusAreas({ view }: { view: AnalyticsView }) {
  const focus = focusAreas(view.skills, 3);
  if (focus.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Your weakest skills — worth some focused practice:
      </p>
      <ul className="mt-3 space-y-2">
        {focus.map((s) => {
          const pct = accuracyPct(s.correct, s.total);
          return (
            <li key={`${s.section}-${s.skill}`} className="text-sm text-amber-900">
              <span className="font-semibold">{humanizeSkill(s.skill)}</span>{' '}
              <span className="text-amber-700">
                ({SECTION_LABELS[s.section]})
              </span>{' '}
              — {pct}% over {s.total} {s.total === 1 ? 'attempt' : 'attempts'}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
