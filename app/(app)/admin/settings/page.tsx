import Link from 'next/link';
import { getDailyLimit } from '@/app/lib/config';
import { setDailyAttemptLimit } from '@/app/lib/admin/actions';

export default async function AdminSettingsPage() {
  const limit = await getDailyLimit();
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
    </main>
  );
}
