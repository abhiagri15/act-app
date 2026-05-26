import Link from 'next/link';
import { resolveFlag } from '@/app/lib/admin/actions';
import { FLAG_REASON_LABELS, type FlagReason } from '@/app/lib/feedback/schemas';
import type { FlagWithQuestion } from '@/app/lib/admin/flags';
import type { ActSection } from '@/app/lib/act/format';

const SECTION_LABEL: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

const REASON_BADGE: Record<string, string> = {
  incorrect_answer: 'bg-red-100 text-red-800',
  ambiguous: 'bg-amber-100 text-amber-800',
  typo: 'bg-blue-100 text-blue-800',
  other: 'bg-slate-100 text-slate-700',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-800',
  resolved: 'bg-slate-100 text-slate-600',
  dismissed: 'bg-slate-100 text-slate-500',
};

function truncate(s: string, n = 160): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function reasonLabel(reason: string): string {
  return FLAG_REASON_LABELS[reason as FlagReason] ?? reason;
}

// One flag row: reason + section badges, the truncated question stem
// (linked to /admin/questions/[id]), reporter, optional notes, and the
// Mark-resolved / Dismiss forms for an open flag.
export function FlagRow({ flag }: { flag: FlagWithQuestion }) {
  const reporter = flag.user_full_name?.trim() || flag.user_email || `User ${flag.user_id.slice(0, 6)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            REASON_BADGE[flag.reason] ?? REASON_BADGE.other
          }`}
        >
          {reasonLabel(flag.reason)}
        </span>
        {flag.question_section && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {SECTION_LABEL[flag.question_section]}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 ${
            STATUS_BADGE[flag.status] ?? STATUS_BADGE.open
          }`}
        >
          {flag.status}
        </span>
        {!flag.question_enabled && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
            Question disabled
          </span>
        )}
        <span className="text-slate-400">
          {new Date(flag.created_at).toLocaleString()}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
        {truncate(flag.question_stem)}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Reported by {reporter}
      </p>

      {flag.notes && (
        <p className="mt-2 rounded bg-slate-50 p-2 text-xs italic text-slate-600">
          “{flag.notes}”
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/questions/${flag.question_id}`}
          className="text-xs text-blue-600 underline hover:text-blue-800"
        >
          View question
        </Link>
        {flag.status === 'open' && (
          <>
            <form action={resolveFlag}>
              <input type="hidden" name="id" value={flag.id} />
              <input type="hidden" name="status" value="resolved" />
              <button
                type="submit"
                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Mark resolved
              </button>
            </form>
            <form action={resolveFlag}>
              <input type="hidden" name="id" value={flag.id} />
              <input type="hidden" name="status" value="dismissed" />
              <button
                type="submit"
                className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Dismiss
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
