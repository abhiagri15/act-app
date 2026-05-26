import Link from 'next/link';
import { getOrCreateProfile } from '@/app/lib/auth/profile';
import { getAnalytics } from '@/app/lib/analytics/queries';
import { SummaryStats } from '@/app/components/analytics/SummaryStats';
import { ScoreTrend } from '@/app/components/analytics/ScoreTrend';
import { SectionTrend } from '@/app/components/analytics/SectionTrend';
import { SectionAccuracy } from '@/app/components/analytics/SectionAccuracy';
import { SkillAccuracy } from '@/app/components/analytics/SkillAccuracy';
import { FocusAreas } from '@/app/components/analytics/FocusAreas';
import { Button } from '@/app/components/ui/button';

// /analytics — server component. Reads act.user_analytics() via the
// security-invoker RPC; RLS scopes the result to the signed-in user.
// Empty state when no submitted attempts; otherwise renders summary +
// score trend + section trend + section accuracy + skill accuracy + focus.
export default async function AnalyticsPage() {
  const profile = await getOrCreateProfile();
  const view = await getAnalytics();

  if (view.tests_taken === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Your analytics</h1>
        <p className="text-sm text-slate-600">
          Signed in as {profile?.full_name || profile?.email}.
        </p>
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            Take a practice test to see your analytics. Once you submit your
            first attempt, this page will show your score trend, per-section
            accuracy, and the skills worth focusing on.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Begin practice test</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold">Your analytics</h1>

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
    </main>
  );
}
