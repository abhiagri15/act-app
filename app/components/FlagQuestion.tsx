'use client';

import { useState } from 'react';
import { submitFlag } from '@/app/lib/feedback/actions';
import { FLAG_REASON_LABELS, type FlagReason } from '@/app/lib/feedback/schemas';

const REASON_OPTIONS: { value: FlagReason; label: string }[] = [
  { value: 'incorrect_answer', label: FLAG_REASON_LABELS.incorrect_answer },
  { value: 'ambiguous', label: FLAG_REASON_LABELS.ambiguous },
  { value: 'typo', label: FLAG_REASON_LABELS.typo },
  { value: 'other', label: FLAG_REASON_LABELS.other },
];

type Status = 'idle' | 'submitting' | 'done' | 'error';

// "Report a problem with this question" widget rendered inside ReviewItem.
// One placement, two surfaces: this appears on both the post-test results
// review and the saved-attempt review at /dashboard/attempts/[id].
// On success: locks into the "Reported. Thanks." final state — no second
// submission for this widget instance (the per-session guard).
export function FlagQuestion({ questionId }: { questionId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<FlagReason>('incorrect_answer');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === 'done') {
    return (
      <p className="mt-3 text-xs text-emerald-700">Reported. Thanks.</p>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 text-xs text-slate-400 underline hover:text-slate-600"
      >
        ⚐ Report a problem with this question
      </button>
    );
  }

  async function submit() {
    setStatus('submitting');
    setErrorMsg(null);
    const trimmed = notes.trim();
    const res = await submitFlag({
      question_id: questionId,
      reason,
      notes: trimmed === '' ? undefined : trimmed,
    });
    if (res.ok) {
      setStatus('done');
    } else {
      setStatus('error');
      setErrorMsg(res.error);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Report a problem
      </p>
      <div className="space-y-1.5">
        {REASON_OPTIONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={`flag-reason-${questionId}`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
            />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything else? (optional)"
        maxLength={500}
        rows={2}
        className="mt-2 w-full rounded border border-slate-300 p-1.5 text-sm"
      />
      {status === 'error' && errorMsg && (
        <p className="mt-1 text-xs text-red-600">{errorMsg}</p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={status === 'submitting'}
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {status === 'submitting' ? 'Submitting…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setReason('incorrect_answer');
            setNotes('');
            setStatus('idle');
            setErrorMsg(null);
          }}
          className="rounded px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
