import { redirect } from 'next/navigation';
import { finalizeAttempt } from '@/app/lib/persistence/actions';
import { ResultsScreen } from '@/app/components/test/ResultsScreen';

// Server component. Finalises the attempt (idempotent) and renders results.
// Once finalised the layout will redirect any future visits to
// /dashboard/attempts/[id] — so this page is shown exactly once at the
// end of a test.
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  try {
    const results = await finalizeAttempt(attemptId);
    return <ResultsScreen results={results} />;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to finalise';
    console.error('[ResultsPage] finalize failed:', msg);
    // If finalize failed because sections aren't all locked, redirect to
    // the dashboard — the user can resume from there.
    redirect('/');
  }
}
