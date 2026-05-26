import { redirect } from 'next/navigation';
import { guardSectionRoute, nextSectionHref } from '../route-guards';
import { startSection } from '@/app/lib/persistence/actions';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { SectionRunner } from '@/app/components/test/SectionRunner';

export default async function ReadingSectionPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const guard = await guardSectionRoute(attemptId, 'reading');
  if (guard.status === 'redirect') redirect(guard.href);

  await startSection(attemptId, 'reading');
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');

  const sectionState = snapshot.section_state as Record<
    string,
    { ends_at?: string } | undefined
  >;
  const endsAt = sectionState['reading']?.ends_at;
  if (!endsAt) redirect('/');

  const questions = snapshot.questions.filter((q) => q.section === 'reading');
  const passages = snapshot.passages.filter((p) => p.section === 'reading');
  const responses = snapshot.responses.filter((r) => r.section === 'reading');

  return (
    <SectionRunner
      attemptId={attemptId}
      section="reading"
      questions={questions}
      passages={passages}
      endsAt={endsAt}
      initialResponses={responses}
      nextHref={nextSectionHref(attemptId, 'reading', snapshot.include_science)}
    />
  );
}
