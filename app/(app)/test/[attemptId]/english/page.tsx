import { redirect } from 'next/navigation';
import { guardSectionRoute, nextSectionHref } from '../route-guards';
import { startSection } from '@/app/lib/persistence/actions';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { SectionRunner } from '@/app/components/test/SectionRunner';

export default async function EnglishSectionPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Initial guard.
  const guard = await guardSectionRoute(attemptId, 'english');
  if (guard.status === 'redirect') redirect(guard.href);

  // Start (idempotent if already started).
  await startSection(attemptId, 'english');

  // Re-fetch the snapshot AFTER start_section so we have ends_at populated.
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');

  const sectionState = snapshot.section_state as Record<
    string,
    { ends_at?: string } | undefined
  >;
  const endsAt = sectionState['english']?.ends_at;
  if (!endsAt) redirect('/');

  const questions = snapshot.questions.filter((q) => q.section === 'english');
  const passages = snapshot.passages.filter((p) => p.section === 'english');
  const responses = snapshot.responses.filter((r) => r.section === 'english');

  return (
    <SectionRunner
      attemptId={attemptId}
      section="english"
      questions={questions}
      passages={passages}
      endsAt={endsAt}
      initialResponses={responses}
      nextHref={nextSectionHref(attemptId, 'english', snapshot.include_science)}
    />
  );
}
