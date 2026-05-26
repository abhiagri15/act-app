'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { createClient } from '@/app/lib/supabase/client';
import {
  SECTION_DURATIONS_SEC,
  SECTION_QUESTION_COUNTS,
  type ActSection,
} from '@/app/lib/act/format';

const SECTIONS: { key: ActSection; label: string }[] = [
  { key: 'english', label: 'English' },
  { key: 'math', label: 'Math' },
  { key: 'reading', label: 'Reading' },
  { key: 'science', label: 'Science' },
];

function formatMinutes(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}

export function NewTestForm() {
  const router = useRouter();
  const [includeScience, setIncludeScience] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    setShowConfirm(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase
        .schema('act')
        .rpc('draw_test', { p_include_science: includeScience });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      const payload = data as { attempt_id?: string } | null;
      const attemptId = payload?.attempt_id;
      if (!attemptId) {
        setError('Test was created but no attempt id was returned. Try again.');
        return;
      }
      router.push(`/test/${attemptId}/english`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a full Enhanced ACT test</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-600">
          The full Enhanced ACT runs section-by-section under timed conditions. You
          can&apos;t pause once started. Section timers auto-submit at zero.
        </p>

        <div className="mb-5 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Questions</th>
                <th className="px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SECTIONS.filter((s) => includeScience || s.key !== 'science').map((s) => (
                <tr key={s.key}>
                  <td className="px-3 py-2 font-medium text-slate-700">{s.label}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {SECTION_QUESTION_COUNTS[s.key]}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatMinutes(SECTION_DURATIONS_SEC[s.key])}
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-50">
                <td className="px-3 py-2 italic text-amber-700">
                  10-min break (after Math)
                </td>
                <td className="px-3 py-2 text-slate-500">—</td>
                <td className="px-3 py-2 text-slate-500">10 min</td>
              </tr>
            </tbody>
          </table>
        </div>

        <label className="mb-4 flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={includeScience}
            onChange={(e) => setIncludeScience(e.target.checked)}
            disabled={isPending}
          />
          <span className="text-sm text-slate-700">
            Include Science section (40 questions, 40 min). Composite still scales to 1–36.
          </span>
        </label>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button onClick={() => setShowConfirm(true)} disabled={isPending}>
          {isPending ? 'Starting…' : 'Start'}
        </Button>

        {showConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Ready to start?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-slate-600">
                  You can&apos;t pause once started. Section timers are locked. If your
                  browser closes you can resume the test from the dashboard, but the
                  timer keeps running.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleStart} disabled={isPending}>
                    {isPending ? 'Starting…' : 'Yes, start'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowConfirm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
