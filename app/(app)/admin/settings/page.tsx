import Link from 'next/link';
import { getDailyLimit } from '@/app/lib/config';
import {
  setDailyAttemptLimit,
  setFloorConfig,
} from '@/app/lib/admin/actions';
import { getFloorStatus } from '@/app/lib/admin/floor';

export default async function AdminSettingsPage() {
  const [limit, floor] = await Promise.all([getDailyLimit(), getFloorStatus()]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">App settings</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-800">
          Daily test-attempt limit
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The per-user cap on tests started in a UTC calendar day. The cap is
          enforced inside the act.draw_test RPC as the airtight backstop;
          the friendly Start-test gate uses this same value.
        </p>

        <form
          action={setDailyAttemptLimit}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col text-xs text-slate-600">
            <span className="mb-1 font-medium uppercase tracking-wide">
              Limit
            </span>
            <input
              type="number"
              name="limit"
              defaultValue={limit}
              min={1}
              max={100}
              required
              className="w-32 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
          <p className="text-xs text-slate-500">
            Currently <span className="font-medium">{limit}</span> attempts/day.
          </p>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-800">
          Question pool minimum floor
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The generator sorts batches by fill-ratio. Cells below the floor are
          forced to the top of the plan (fillRatio = 0) so empty buckets are
          backfilled first.{' '}
          <Link
            href="/admin/floor-status"
            className="text-blue-600 underline"
          >
            See which cells are currently below floor
          </Link>
          .
        </p>

        <form
          action={setFloorConfig}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col text-xs text-slate-600">
            <span className="mb-1 font-medium uppercase tracking-wide">
              Skill floor
            </span>
            <input
              type="number"
              name="min_skill_floor"
              defaultValue={floor.skill_floor}
              min={0}
              max={50}
              required
              className="w-32 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            <span className="mb-1 font-medium uppercase tracking-wide">
              Passage floor
            </span>
            <input
              type="number"
              name="min_passage_floor"
              defaultValue={floor.passage_floor}
              min={0}
              max={20}
              required
              className="w-32 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
        </form>

        <ul className="mt-4 space-y-1 text-xs text-slate-500">
          <li>
            <span className="font-medium text-slate-700">Skill floor:</span>{' '}
            every (math skill, difficulty) cell must have at least this many
            enabled questions. Cells below floor are top-priority for the
            generator.
          </li>
          <li>
            <span className="font-medium text-slate-700">Passage floor:</span>{' '}
            every passage type must have at least this many enabled passages.
          </li>
          <li className="pt-1">
            Currently{' '}
            <span className="font-medium">{floor.skill_floor}</span> per math
            cell ·{' '}
            <span className="font-medium">{floor.passage_floor}</span> per
            passage type ·{' '}
            <span className="font-medium">{floor.below_floor_count}</span> of{' '}
            {floor.rows.length} cells below floor.
          </li>
        </ul>
      </section>
    </main>
  );
}
