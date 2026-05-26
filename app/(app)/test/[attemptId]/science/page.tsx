import { redirect, notFound } from 'next/navigation';
import { guardSectionRoute, nextSectionHref } from '../route-guards';
import { startSection } from '@/app/lib/persistence/actions';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { SectionRunner } from '@/app/components/test/SectionRunner';

export default async function ScienceSectionPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const guard = await guardSectionRoute(attemptId, 'science');
  if (guard.status === 'redirect') redirect(guard.href);
  // Defensive: if the attempt was started without Science, this page shouldn't be reachable.
  if (guard.snapshot && !guard.snapshot.include_science) notFound();

  await startSection(attemptId, 'science');
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');

  const sectionState = snapshot.section_state as Record<
    string,
    { ends_at?: string } | undefined
  >;
  const endsAt = sectionState['science']?.ends_at;
  if (!endsAt) redirect('/');

  const questions = snapshot.questions.filter((q) => q.section === 'science');
  const passages = snapshot.passages.filter((p) => p.section === 'science');
  const responses = snapshot.responses.filter((r) => r.section === 'science');

  return (
    <SectionRunner
      attemptId={attemptId}
      section="science"
      questions={questions}
      passages={passages}
      endsAt={endsAt}
      initialResponses={responses}
      nextHref={nextSectionHref(attemptId, 'science', snapshot.include_science)}
    />
  );
}
