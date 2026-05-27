import Link from 'next/link';
import { getFloorStatus, type FloorRow } from '@/app/lib/admin/floor';

// /admin/floor-status — live view of which (skill, difficulty) and
// (passage_type) cells are currently below floor. Rows are pre-sorted by
// deficit desc so the most-deficit cells (= top priority for the next
// generation run) are at the top.
export default async function AdminFloorStatusPage() {
  const floor = await getFloorStatus();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Pool floor status</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">
          {floor.below_floor_count > 0 ? (
            <>
              <span className="font-semibold text-amber-700">
                {floor.below_floor_count} of {floor.rows.length} cells below
                floor
              </span>{' '}
              — the next generation run will prioritize these buckets.
            </>
          ) : (
            <>
              <span className="font-semibold text-emerald-700">
                All {floor.rows.length} cells at or above floor.
              </span>{' '}
              The generator will fall back to fill-ratio ordering on the next
              run.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Skill floor:{' '}
          <span className="font-medium text-slate-700">
            {floor.skill_floor}
          </span>{' '}
          per (math skill, difficulty) cell · Passage floor:{' '}
          <span className="font-medium text-slate-700">
            {floor.passage_floor}
          </span>{' '}
          per passage type ·{' '}
          <Link
            href="/admin/settings"
            className="text-blue-600 underline"
          >
            Tune on /admin/settings
          </Link>
          .
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Kind</th>
              <th className="px-3 py-2 text-left font-medium">Bucket</th>
              <th className="px-3 py-2 text-right font-medium">Count</th>
              <th className="px-3 py-2 text-right font-medium">Floor</th>
              <th className="px-3 py-2 text-right font-medium">Deficit</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {floor.rows.map((row) => (
              <Row key={row.bucket + ':' + row.kind} row={row} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Row({ row }: { row: FloorRow }) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-b-0 ${
        row.below_floor ? 'bg-amber-50' : ''
      }`}
    >
      <td className="px-3 py-2 text-slate-600">
        {row.kind === 'passage' ? 'Passage' : 'Math skill'}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-slate-800">
        {row.bucket}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
        {row.count}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
        {row.floor}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
        {row.deficit > 0 ? (
          <span className="font-semibold text-amber-700">{row.deficit}</span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
      <td className="px-3 py-2">
        {row.below_floor ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            BELOW FLOOR
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            OK
          </span>
        )}
      </td>
    </tr>
  );
}
