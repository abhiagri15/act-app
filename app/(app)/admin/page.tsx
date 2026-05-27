import Link from 'next/link';
import { getPoolCounts } from '@/app/lib/admin/queries';
import { listUsersWithStats } from '@/app/lib/admin/users';
import { countOpenFlags } from '@/app/lib/admin/flags';
import { getFloorStatus } from '@/app/lib/admin/floor';
import { getDailyLimit } from '@/app/lib/config';

// /admin — Overview dashboard. Stat cards summarising the pool, user
// count, open flags (sub-project #7), and the daily attempt limit. The
// layout already requires admin via requireAdmin(); no need to re-check.
export default async function AdminOverviewPage() {
  const [pool, users, openFlagCount, floorStatus, dailyLimit] =
    await Promise.all([
      getPoolCounts(),
      listUsersWithStats(),
      countOpenFlags(),
      getFloorStatus(),
      getDailyLimit(),
    ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Admin overview</h1>
      <p className="mb-6 text-sm text-slate-500">
        Pool moderation, user activity, generation activity, and app settings.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          href="/admin/questions"
          title="Question Pool"
          headline={`${pool.questions_enabled} enabled`}
          lines={[
            `${pool.questions_total} total · ${pool.questions_disabled} disabled`,
            `English ${pool.questions_english} · Math ${pool.questions_math}`,
            `Reading ${pool.questions_reading} · Science ${pool.questions_science}`,
          ]}
        />
        <StatCard
          href="/admin/passages"
          title="Passages"
          headline={`${pool.passages_enabled} enabled`}
          lines={[
            `${pool.passages_total} total · ${pool.passages_disabled} disabled`,
            `Disabling a passage cascade-hides its questions.`,
          ]}
        />
        <StatCard
          href="/admin/users"
          title="Users"
          headline={`${users.length} user${users.length === 1 ? '' : 's'}`}
          lines={[
            `${users.reduce((s, u) => s + u.tests_taken, 0)} attempts total`,
            `Click for per-user analytics.`,
          ]}
        />
        <StatCard
          href="/admin/flags?status=open"
          title="Open Flags"
          headline={`${openFlagCount} open`}
          lines={[
            `User-reported question problems.`,
            `Mark resolved or dismiss from /admin/flags.`,
          ]}
        />
        <StatCard
          href="/admin/floor-status"
          title="Pool floor status"
          headline={`${floorStatus.below_floor_count} of ${floorStatus.rows.length} below floor`}
          warn={floorStatus.below_floor_count > 0}
          lines={[
            `Skill floor ${floorStatus.skill_floor} · Passage floor ${floorStatus.passage_floor}.`,
            `Generator prioritizes below-floor cells.`,
          ]}
        />
        <StatCard
          href="/admin/settings"
          title="Settings"
          headline={`${dailyLimit}/day`}
          lines={[
            `Daily test-attempt limit.`,
            `Adjust on /admin/settings.`,
          ]}
        />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Link
          href="/admin/generation"
          className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <h2 className="text-base font-semibold text-slate-800">
            Generation log
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Recent n8n / Vercel cron generation runs.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <h2 className="text-base font-semibold text-slate-800">
            App settings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Adjust the daily test-attempt cap.
          </p>
        </Link>
      </section>
    </main>
  );
}

function StatCard({
  href,
  title,
  headline,
  lines,
  warn,
}: {
  href: string;
  title: string;
  headline: string;
  lines: string[];
  warn?: boolean;
}) {
  const cls = warn
    ? 'block rounded-lg border border-amber-300 bg-amber-50 p-4 transition hover:border-amber-400 hover:bg-amber-100'
    : 'block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50';
  const titleCls = warn
    ? 'text-xs font-medium uppercase tracking-wide text-amber-700'
    : 'text-xs font-medium uppercase tracking-wide text-slate-500';
  const headCls = warn
    ? 'mt-1 text-2xl font-semibold text-amber-900'
    : 'mt-1 text-2xl font-semibold text-slate-900';
  const lineCls = warn
    ? 'mt-2 space-y-0.5 text-xs text-amber-900'
    : 'mt-2 space-y-0.5 text-xs text-slate-600';
  return (
    <Link href={href} className={cls}>
      <p className={titleCls}>{title}</p>
      <p className={headCls}>{headline}</p>
      <div className={lineCls}>
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </Link>
  );
}
