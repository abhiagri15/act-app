'use client';

import { Button } from '@/app/components/ui/button';
import type { ActSection } from '@/app/lib/act/format';

interface Props {
  section: ActSection;
  remainingSec: number;
  answeredCount: number;
  total: number;
  onReview: () => void;
  onSubmit: () => void;
  submitting: boolean;
  errorMessage?: string | null;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

export function SectionHeader({
  section,
  remainingSec,
  answeredCount,
  total,
  onReview,
  onSubmit,
  submitting,
  errorMessage,
}: Props) {
  const lowTime = remainingSec <= 300;
  return (
    <div className="border-b bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-800">
            {SECTION_LABELS[section]}
          </div>
          <div className="text-xs text-slate-500">
            {answeredCount} of {total} answered
          </div>
        </div>
        <div
          className={`rounded-md px-3 py-1.5 font-mono text-lg font-semibold ${
            lowTime ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
          }`}
          aria-live="polite"
        >
          {fmtTime(remainingSec)}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReview}>
            Review
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit section'}
          </Button>
        </div>
      </div>
      {errorMessage && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
