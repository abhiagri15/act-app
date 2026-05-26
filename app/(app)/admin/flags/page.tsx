import Link from 'next/link';
import { listFlags, getFlagCounts, type FlagStatus } from '@/app/lib/admin/flags';
import { FlagRow } from '@/app/components/admin/FlagRow';

const STATUS_FILTERS: { label: string; status: FlagStatus | 'all' }[] = [
  { label: 'Open', status: 'open' },
  { label: 'Resolved', status: 'resolved' },
  { label: 'Dismissed', status: 'dismissed' },
  { label: 'All', status: 'all' },
];

function parseStatus(raw: string | undefined): FlagStatus | 'all' {
  if (raw === 'resolved' || raw === 'dismissed' || raw === 'all') return raw;
  return 'open';
}

export default async function AdminFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const [flags, counts] = await Promise.all([
    listFlags(status),
    getFlagCounts(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Question flags</h1>
      <p className="text-sm text-slate-500">
        User-reported problems with pool questions. Disabling a question at
        <Link
          href="/admin/questions"
          className="ml-1 text-blue-600 underline hover:text-blue-800"
        >
          /admin/questions/[id]
        </Link>{' '}
        removes it from new draws.
      </p>

      <p className="mt-2 text-sm text-slate-600">
        <span className="font-medium text-emerald-700">{counts.open} open</span>
        {' · '}
        <span>{counts.resolved} resolved</span>
        {' · '}
        <span>{counts.dismissed} dismissed</span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.status}
            href={f.status === 'open' ? '/admin/flags' : `/admin/flags?status=${f.status}`}
            className={`rounded-full px-3 py-1 text-xs ${
              status === f.status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {flags.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No flags here.
          </p>
        ) : (
          flags.map((f) => <FlagRow key={f.id} flag={f} />)
        )}
      </div>
    </main>
  );
}
