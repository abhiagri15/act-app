// app/how-it-works/_components/Hero.tsx
import Link from 'next/link';
import type { PublicPoolStats } from '@/app/lib/marketing/queries';

interface HeroProps {
  stats: PublicPoolStats | null;
}

export function Hero({ stats }: HeroProps) {
  return (
    <section id="top" className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Enhanced ACT (2025+) practice that matches the real test.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Section-locked timers, real 1&ndash;36 scoring, a four-section composite,
        and AI-generated content cross-checked by a three-model quality vote.
      </p>

      {stats && (
        <p className="mt-6 text-sm text-slate-500">
          <span className="font-semibold text-slate-900">{stats.totalQuestions}</span> questions
          {' · '}
          <span className="font-semibold text-slate-900">{stats.totalPassages}</span> passages
          {' · '}
          refreshed hourly
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/test/new"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start a full test &rarr;
        </Link>
        <Link
          href="/login"
          className="rounded-md px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Free for now. Daily test limit is admin-configurable (default 5).
      </p>
    </section>
  );
}
