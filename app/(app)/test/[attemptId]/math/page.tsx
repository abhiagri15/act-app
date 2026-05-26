import { redirect } from 'next/navigation';
import { guardSectionRoute, nextSectionHref } from '../route-guards';
import { startSection } from '@/app/lib/persistence/actions';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { SectionRunner } from '@/app/components/test/SectionRunner';

export default async function MathSectionPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const guard = await guardSectionRoute(attemptId, 'math');
  if (guard.status === 'redirect') redirect(guard.href);

  await startSection(attemptId, 'math');
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) redirect('/');

  const sectionState = snapshot.section_state as Record<
    string,
    { ends_at?: string } | undefined
  >;
  const endsAt = sectionState['math']?.ends_at;
  if (!endsAt) redirect('/');

  const questions = snapshot.questions.filter((q) => q.section === 'math');
  // Math has no passages.
  const passages: typeof snapshot.passages = [];
  const responses = snapshot.responses.filter((r) => r.section === 'math');

  return (
    <SectionRunner
      attemptId={attemptId}
      section="math"
      questions={questions}
      passages={passages}
      endsAt={endsAt}
      initialResponses={responses}
      nextHref={nextSectionHref(attemptId, 'math', snapshot.include_science)}
    />
  );
}
