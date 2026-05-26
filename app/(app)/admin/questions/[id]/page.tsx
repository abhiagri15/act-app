import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getQuestion } from '@/app/lib/admin/queries';
import { setQuestionEnabled } from '@/app/lib/admin/actions';
import type { ActSection } from '@/app/lib/act/format';

const SECTION_LABEL: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

export default async function AdminQuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const question = await getQuestion(id);
  if (!question) notFound();

  const choices = Array.isArray(question.choices)
    ? (question.choices as Array<{ label?: string; text?: string } | string>)
    : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Question</h1>
        <Link
          href="/admin/questions"
          className="text-sm text-blue-600 underline"
        >
          Back to pool
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {SECTION_LABEL[question.section] ?? question.section}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            {question.skill}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            difficulty {question.difficulty}
          </span>
          {question.passage_id && (
            <Link
              href={`/admin/passages/${question.passage_id}`}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-blue-600 underline"
            >
              View passage
            </Link>
          )}
          {question.passage_marker !== null && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
              marker {question.passage_marker}
            </span>
          )}
          {question.enabled ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
              Enabled
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
              Disabled
            </span>
          )}
        </div>

        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stem
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {question.stem}
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Choices
          </h2>
          <ol className="mt-2 space-y-1">
            {choices.map((choice, i) => {
              const label =
                typeof choice === 'object' && choice !== null && 'label' in choice
                  ? (choice.label as string | undefined) ?? String.fromCharCode(65 + i)
                  : String.fromCharCode(65 + i);
              const text =
                typeof choice === 'object' && choice !== null && 'text' in choice
                  ? ((choice as { text?: string }).text ?? '')
                  : typeof choice === 'string'
                    ? choice
                    : JSON.stringify(choice);
              const isCorrect = label === question.answer_key;
              return (
                <li
                  key={i}
                  className={`rounded border px-3 py-2 text-sm ${
                    isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <span className="mr-2 font-medium">{label}.</span>
                  {text}
                  {isCorrect && (
                    <span className="ml-2 text-xs font-medium text-emerald-700">
                      (correct)
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explanation
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {question.explanation}
          </p>
        </section>

        <section className="mt-5 border-t border-slate-200 pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Metadata
          </h2>
          <dl className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">ID:</dt>{' '}
              <dd className="inline font-mono">{question.id}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Created:</dt>{' '}
              <dd className="inline">
                {new Date(question.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-5 border-t border-slate-200 pt-4">
          <form action={setQuestionEnabled}>
            <input type="hidden" name="id" value={question.id} />
            <input
              type="hidden"
              name="enabled"
              value={(!question.enabled).toString()}
            />
            <button
              type="submit"
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                question.enabled
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {question.enabled
                ? 'Disable this question'
                : 'Re-enable this question'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
