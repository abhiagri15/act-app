import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPassage, getPassageQuestions } from '@/app/lib/admin/queries';
import { setPassageEnabled } from '@/app/lib/admin/actions';
import { StimulusRenderer } from '@/app/components/test/StimulusRenderer';
import { QuestionRow } from '@/app/components/admin/QuestionRow';

const SECTION_LABEL: Record<string, string> = {
  english: 'English',
  reading: 'Reading',
  science: 'Science',
};

export default async function AdminPassageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [passage, children] = await Promise.all([
    getPassage(id),
    getPassageQuestions(id),
  ]);
  if (!passage) notFound();

  const stimuli = Array.isArray(passage.stimuli) ? passage.stimuli : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Passage</h1>
        <Link href="/admin/passages" className="text-sm text-blue-600 underline">
          Back to pool
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {SECTION_LABEL[passage.section] ?? passage.section}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            {passage.passage_type}
          </span>
          {passage.enabled ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
              Enabled
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
              Disabled
            </span>
          )}
        </div>

        {passage.title && (
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            {passage.title}
          </h2>
        )}

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Body
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {passage.body}
          </p>
        </section>

        {stimuli.length > 0 && (
          <section className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stimuli
            </h3>
            <div className="mt-1">
              <StimulusRenderer stimuli={stimuli} />
            </div>
          </section>
        )}

        <section className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Metadata
          </h3>
          <dl className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">ID:</dt>{' '}
              <dd className="inline font-mono">{passage.id}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Created:</dt>{' '}
              <dd className="inline">
                {new Date(passage.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-5 border-t border-slate-200 pt-4">
          <form action={setPassageEnabled}>
            <input type="hidden" name="id" value={passage.id} />
            <input
              type="hidden"
              name="enabled"
              value={(!passage.enabled).toString()}
            />
            <button
              type="submit"
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                passage.enabled
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {passage.enabled
                ? 'Disable this passage (cascade-hides its questions)'
                : 'Re-enable this passage'}
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-base font-semibold text-slate-700">
          Child questions ({children.length})
        </h2>
        {children.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No questions reference this passage yet.
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((q) => (
              <QuestionRow key={q.id} question={q} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
