import { redirect, notFound } from 'next/navigation';
import { getMyAttempt } from '@/app/lib/persistence/queries';

// State-machine guard for the test runner sub-tree. Centralizes the
// "attempt must be live" rule so individual section pages can be thin.
//
// Rules:
// 1. Attempt must exist (else 404).
// 2. If status === 'submitted', redirect to /dashboard/attempts/[id].
// 3. If status === 'abandoned', redirect home.
// 4. Per-section URL-vs-current-section enforcement happens inside each
//    section page (which knows its route segment), via guardSectionRoute()
//    in ./route-guards.ts.
export default async function AttemptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) {
    notFound();
  }
  if (snapshot.status === 'submitted') {
    redirect(`/dashboard/attempts/${attemptId}`);
  }
  if (snapshot.status === 'abandoned') {
    redirect('/');
  }
  return <>{children}</>;
}
