import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMyAttempt } from '@/app/lib/persistence/queries';
import { AttemptSummary } from '@/app/components/review/AttemptSummary';
import { ReviewItem } from '@/app/components/review/ReviewItem';
import { PassagePane } from '@/app/components/test/PassagePane';
import { Button } from '@/app/components/ui/button';
import type { ActSection } from '@/app/lib/act/format';
import type { AttemptPassage, AttemptQuestion } from '@/app/lib/persistence/schema';

const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

const SECTION_ORDER: ActSection[] = ['english', 'math', 'reading', 'science'];

function PassageBlock({ passage }: { passage: AttemptPassage }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PassagePane passage={passage} />
    </div>
  );
}

export default async function AttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = await getMyAttempt(id);
  if (!snapshot) notFound();

  const responseByQid = new Map(
    snapshot.responses.map((r) => [r.question_id, r] as const),
  );
  const passageById = new Map(
    snapshot.passages.map((p) => [p.id, p] as const),
  );

  const sectionsToRender = SECTION_ORDER.filter((s) =>
    s === 'science' ? snapshot.include_science : true,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Back to dashboard
        </Link>
      </div>

      <AttemptSummary snapshot={snapshot} />

      {sectionsToRender.map((section) => {
        const sectionQuestions = snapshot.questions.filter(
          (q) => q.section === section,
        );
        if (sectionQuestions.length === 0) return null;

        // Group questions by passage_id (math: all under "no passage").
        const byPassage = new Map<string | null, AttemptQuestion[]>();
        for (const q of sectionQuestions) {
          const k = q.passage_id ?? null;
          const arr = byPassage.get(k) ?? [];
          arr.push(q);
          byPassage.set(k, arr);
        }

        return (
          <section key={section} className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-700">
              {SECTION_LABELS[section]} ({sectionQuestions.length})
            </h2>
            <div className="space-y-6">
              {Array.from(byPassage.entries()).map(([passageId, qs]) => {
                const passage = passageId ? passageById.get(passageId) ?? null : null;
                return (
                  <div key={passageId ?? 'no-passage'} className="space-y-3">
                    {passage && <PassageBlock passage={passage} />}
                    {qs.map((q, i) => {
                      // Compute the absolute index in the section for the
                      // displayed question number. Find this question's
                      // position in the full section list (1-indexed).
                      const idx = sectionQuestions.findIndex(
                        (qq) => qq.question_id === q.question_id,
                      );
                      return (
                        <ReviewItem
                          key={q.question_id}
                          question={q}
                          response={responseByQid.get(q.question_id)}
                          index={idx >= 0 ? idx : i}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="mt-10 flex justify-center">
        <Link href="/">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
