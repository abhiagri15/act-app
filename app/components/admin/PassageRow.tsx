import Link from 'next/link';
import { setPassageEnabled } from '@/app/lib/admin/actions';
import type { AdminPassage } from '@/app/lib/admin/queries';

function truncate(s: string, n = 160): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const SECTION_LABEL: Record<string, string> = {
  english: 'English',
  reading: 'Reading',
  science: 'Science',
};

// One passage-pool row: section + passage_type badges, optional title,
// truncated body, and an enable/disable toggle. Disabling a passage
// cascade-hides its child questions from new draws.
export function PassageRow({ passage }: { passage: AdminPassage }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          {SECTION_LABEL[passage.section] ?? passage.section}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
          {passage.passage_type}
        </span>
        {passage.enabled ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
            Enabled
          </span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            Disabled
          </span>
        )}
      </div>
      {passage.title && (
        <p className="mt-2 text-sm font-medium text-slate-900">{passage.title}</p>
      )}
      <p className="mt-1 text-sm text-slate-700">{truncate(passage.body)}</p>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/admin/passages/${passage.id}`}
          className="text-xs text-blue-600 underline"
        >
          View
        </Link>
        <form action={setPassageEnabled}>
          <input type="hidden" name="id" value={passage.id} />
          <input
            type="hidden"
            name="enabled"
            value={(!passage.enabled).toString()}
          />
          <button
            type="submit"
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              passage.enabled
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {passage.enabled ? 'Disable' : 'Enable'}
          </button>
        </form>
      </div>
    </div>
  );
}
