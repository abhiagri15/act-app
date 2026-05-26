import Link from 'next/link';
import { listPassages, type PassageFilters } from '@/app/lib/admin/queries';
import { PassageRow } from '@/app/components/admin/PassageRow';
import type { PassageType } from '@/app/lib/act/format';

type SearchParams = Promise<{
  section?: string;
  passage_type?: string;
  status?: string;
}>;

const SECTION_LABEL: Record<string, string> = {
  english: 'English',
  reading: 'Reading',
  science: 'Science',
};

const PASSAGE_TYPES_BY_SECTION: Record<string, PassageType[]> = {
  english: ['english_essay'],
  reading: ['literary_narrative', 'social_science', 'humanities', 'natural_science'],
  science: ['data_representation', 'research_summaries', 'conflicting_viewpoints'],
};

function isPassageSection(v: unknown): v is 'english' | 'reading' | 'science' {
  return v === 'english' || v === 'reading' || v === 'science';
}

function isStatus(v: unknown): v is 'enabled' | 'disabled' | 'all' {
  return v === 'enabled' || v === 'disabled' || v === 'all';
}

export default async function AdminPassagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const section = isPassageSection(params.section) ? params.section : undefined;
  const passageType =
    params.passage_type && params.passage_type !== 'all'
      ? (params.passage_type as PassageType)
      : undefined;
  const status = isStatus(params.status) ? params.status : 'enabled';

  const filters: PassageFilters = {
    section,
    passage_type: passageType,
    status,
  };
  const passages = await listPassages(filters);

  const availableTypes = section
    ? PASSAGE_TYPES_BY_SECTION[section]
    : Array.from(
        new Set(Object.values(PASSAGE_TYPES_BY_SECTION).flat()),
      ) as PassageType[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Passage pool</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <p className="mb-4 text-sm text-slate-600">
        Disabling a passage cascade-hides its child questions from new draws.
      </p>

      <form
        method="GET"
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
      >
        <FilterSelect name="section" label="Section" value={section ?? 'all'}>
          <option value="all">All</option>
          {Object.entries(SECTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          name="passage_type"
          label="Type"
          value={passageType ?? 'all'}
        >
          <option value="all">All</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>
              {t}
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
        Showing {passages.length} passage{passages.length === 1 ? '' : 's'}
        {passages.length === 200 ? ' (capped at 200)' : ''}.
      </p>

      {passages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No passages match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {passages.map((p) => (
            <PassageRow key={p.id} passage={p} />
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
