import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getUserProfileForAdmin,
  getUserAnalyticsForAdmin,
} from '@/app/lib/admin/users';
import { SummaryStats } from '@/app/components/analytics/SummaryStats';
import { ScoreTrend } from '@/app/components/analytics/ScoreTrend';
import { SectionTrend } from '@/app/components/analytics/SectionTrend';
import { SectionAccuracy } from '@/app/components/analytics/SectionAccuracy';
import { SkillAccuracy } from '@/app/components/analytics/SkillAccuracy';
import { FocusAreas } from '@/app/components/analytics/FocusAreas';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, view] = await Promise.all([
    getUserProfileForAdmin(id),
    getUserAnalyticsForAdmin(id),
  ]);
  if (!profile) notFound();

  const displayName = profile.full_name || profile.email || `User ${profile.id.slice(0, 8)}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {profile.email ?? '—'}
            {profile.role === 'admin' && (
              <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Admin
              </span>
            )}
          </p>
        </div>
        <Link href="/admin/users" className="text-sm text-blue-600 underline">
          Back to users
        </Link>
      </div>

      {view.tests_taken === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          This user has not submitted any tests yet.
        </div>
      ) : (
        <>
          <SummaryStats view={view} />

          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-700">
              Composite trend
            </h2>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <ScoreTrend trend={view.trend} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-700">
              Section trend
            </h2>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <SectionTrend trend={view.trend} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-700">
              Section accuracy
            </h2>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <SectionAccuracy sections={view.sections} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-700">
              Focus areas
            </h2>
            <FocusAreas view={view} />
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold text-slate-700">
              Skill breakdown
            </h2>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <SkillAccuracy skills={view.skills} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
