import Link from 'next/link';
import { listQuestions, type QuestionFilters } from '@/app/lib/admin/queries';
import { QuestionRow } from '@/app/components/admin/QuestionRow';
import { SECTION_ORDER, SKILLS, type ActSection } from '@/app/lib/act/format';

type SearchParams = Promise<{
  section?: string;
  skill?: string;
  status?: string;
}>;

const SECTION_LABEL: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

function isSection(v: unknown): v is ActSection {
  return (
    v === 'english' || v === 'math' || v === 'reading' || v === 'science'
  );
}

function isStatus(v: unknown): v is 'enabled' | 'disabled' | 'all' {
  return v === 'enabled' || v === 'disabled' || v === 'all';
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const section = isSection(params.section) ? params.section : undefined;
  const skill = params.skill && params.skill !== 'all' ? params.skill : undefined;
  const status = isStatus(params.status) ? params.status : 'enabled';

  const filters: QuestionFilters = {
    section,
    skill,
    status,
  };
  const questions = await listQuestions(filters);

  const availableSkills = section
    ? SKILLS[section]
    : Array.from(new Set(SECTION_ORDER.flatMap((s) => SKILLS[s])));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Question pool</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <form
        method="GET"
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
      >
        <FilterSelect name="section" label="Section" value={section ?? 'all'}>
          <option value="all">All</option>
          {SECTION_ORDER.map((s) => (
            <option key={s} value={s}>
              {SECTION_LABEL[s]}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect name="skill" label="Skill" value={skill ?? 'all'}>
          <option value="all">All</option>
          {availableSkills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect name="status" label="Status" value={status}>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="all">All</option>
        </FilterSelect>

        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      <p className="mb-3 text-sm text-slate-600">
        Showing {questions.length} question{questions.length === 1 ? '' : 's'}
        {questions.length === 200 ? ' (capped at 200)' : ''}.
      </p>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No questions match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionRow key={q.id} question={q} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col text-xs text-slate-600">
      <span className="mb-1 font-medium uppercase tracking-wide">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        {children}
      </select>
    </label>
  );
}
