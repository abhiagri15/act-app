import { redirect } from 'next/navigation';
import { guardSectionRoute } from '../route-guards';
import { startSection } from '@/app/lib/persistence/actions';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { BreakScreen } from '@/app/components/test/BreakScreen';

export default async function BreakPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const guard = await guardSectionRoute(attemptId, 'break');
  if (guard.status === 'redirect') redirect(guard.href);

  await startSection(attemptId, 'break');
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');

  const stateMap = snapshot.section_state as Record<
    string,
    { ends_at?: string } | undefined
  >;
  const endsAt = stateMap['break']?.ends_at;
  if (!endsAt) redirect('/');

  return <BreakScreen attemptId={attemptId} endsAt={endsAt} />;
}
