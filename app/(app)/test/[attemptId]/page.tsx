import { redirect } from 'next/navigation';
import { getMyAttempt } from '@/app/lib/persistence/queries';

// Bare /test/[attemptId] — redirects to current_section (or english if not started).
// Useful entry point from the dashboard "Resume" link on an in-progress attempt.
export default async function AttemptIndexPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');
  if (snapshot.status === 'submitted') {
    redirect(`/dashboard/attempts/${attemptId}`);
  }
  const cur = snapshot.current_section ?? 'english';
  redirect(`/test/${attemptId}/${cur}`);
}
