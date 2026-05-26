'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitSection,
  upsertResponse,
  forceLockSection,
} from '@/app/lib/persistence/actions';
import type { ActSection } from '@/app/lib/act/format';
import type { AttemptQuestion, AttemptResponse } from '@/app/lib/persistence/schema';

export type Choice = 'A' | 'B' | 'C' | 'D';

export interface ResponseState {
  selected: Choice | null;
  flagged: boolean;
}

export type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

export interface UseTestSessionArgs {
  attemptId: string;
  section: ActSection;
  questions: AttemptQuestion[];
  endsAt: string;
  initialResponses: AttemptResponse[];
  // Where to navigate on a successful submit.
  nextHref: string;
}

export interface UseTestSessionReturn {
  currentQuestionIdx: number;
  responses: ResponseState[];
  remainingSec: number;
  setAnswer: (idx: number, choice: Choice) => void;
  clearAnswer: (idx: number) => void;
  toggleFlag: (idx: number) => void;
  goToQuestion: (idx: number) => void;
  goToReview: () => void;
  exitReview: () => void;
  isReviewing: boolean;
  submitNow: () => void;
  submitState: SubmitState;
  errorMessage: string | null;
  answeredCount: number;
  flaggedCount: number;
}

// Per spec §4. Drives one section's worth of state: timer countdown, the
// per-question answer/flag matrix, optimistic upsertResponse writes,
// auto-submit on timer expiry, and navigation on successful submit.
//
// The hook owns NO persistence side-effects beyond the fire-and-forget
// `upsertResponse` call (which the server actions wrap). The shape mirrors
// SAT's useTestSession but with ACT specifics:
//   - per-section timer (not per-test)
//   - mcq-only (no SPR)
//   - submit on time-up auto-advances to nextHref
export function useTestSession(args: UseTestSessionArgs): UseTestSessionReturn {
  const { attemptId, section, questions, endsAt, initialResponses, nextHref } = args;
  const router = useRouter();

  // Build the initial parallel response matrix from the snapshot data.
  const initialMatrix = useMemo<ResponseState[]>(() => {
    const byId = new Map<string, AttemptResponse>();
    for (const r of initialResponses) byId.set(r.question_id, r);
    return questions.map((q) => {
      const r = byId.get(q.question_id);
      return {
        selected: (r?.selected ?? null) as Choice | null,
        flagged: r?.flagged ?? false,
      };
    });
  }, [questions, initialResponses]);

  const [responses, setResponses] = useState<ResponseState[]>(initialMatrix);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const endsAtMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const computeRemaining = useCallback(() => {
    return Math.max(0, Math.round((endsAtMs - Date.now()) / 1000));
  }, [endsAtMs]);
  const [remainingSec, setRemainingSec] = useState(computeRemaining);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Guards exactly-once auto-submit at zero.
  const autoSubmittedRef = useRef(false);
  // Debounce timer per-question, keyed by index.
  const debounceTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // The driving 1-sec countdown.
  useEffect(() => {
    const tick = () => setRemainingSec(computeRemaining());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [computeRemaining]);

  // Auto-submit when the timer hits zero. submitNow does the work.
  const submitNow = useCallback(() => {
    if (submitState === 'submitting' || submitState === 'submitted') return;
    setSubmitState('submitting');
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const payload = questions.map((q, idx) => ({
          question_id: q.question_id,
          selected: responses[idx]?.selected ?? null,
          flagged: responses[idx]?.flagged ?? false,
        }));
        try {
          await submitSection(attemptId, section, payload);
        } catch (e) {
          // If the deadline was missed by >10s, fall back to forceLock.
          const msg = e instanceof Error ? e.message : String(e);
          if (/section deadline missed/i.test(msg)) {
            await forceLockSection(attemptId, section);
          } else {
            throw e;
          }
        }
        setSubmitState('submitted');
        router.push(nextHref);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to submit section';
        setSubmitState('error');
        setErrorMessage(msg);
      }
    });
  }, [submitState, questions, responses, attemptId, section, router, nextHref]);

  useEffect(() => {
    if (remainingSec === 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitNow();
    }
  }, [remainingSec, submitNow]);

  // Schedules a fire-and-forget upsertResponse for question `idx`, debounced
  // 200ms so rapid clicks don't flood. Always uses the freshest matrix.
  const persistResponse = useCallback(
    (idx: number, next: ResponseState) => {
      const map = debounceTimersRef.current;
      const existing = map.get(idx);
      if (existing) clearTimeout(existing);
      const q = questions[idx];
      if (!q) return;
      const t = setTimeout(() => {
        upsertResponse(attemptId, q.question_id, next.selected, next.flagged).catch(
          (e: unknown) => {
            // Fire-and-forget: log but don't surface. The submit_section path
            // is the airtight backstop (it upserts every response in payload).
            console.warn(
              '[useTestSession] upsertResponse failed (will retry on submit):',
              e,
            );
          },
        );
        map.delete(idx);
      }, 200);
      map.set(idx, t);
    },
    [attemptId, questions],
  );

  // Cleanup any pending debounce on unmount.
  useEffect(() => {
    const map = debounceTimersRef.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const setAnswer = useCallback(
    (idx: number, choice: Choice) => {
      setResponses((prev) => {
        const cur = prev[idx];
        if (!cur) return prev;
        const next = prev.slice();
        const updated = { ...cur, selected: choice };
        next[idx] = updated;
        persistResponse(idx, updated);
        return next;
      });
    },
    [persistResponse],
  );

  const clearAnswer = useCallback(
    (idx: number) => {
      setResponses((prev) => {
        const cur = prev[idx];
        if (!cur) return prev;
        const next = prev.slice();
        const updated = { ...cur, selected: null };
        next[idx] = updated;
        persistResponse(idx, updated);
        return next;
      });
    },
    [persistResponse],
  );

  const toggleFlag = useCallback(
    (idx: number) => {
      setResponses((prev) => {
        const cur = prev[idx];
        if (!cur) return prev;
        const next = prev.slice();
        const updated = { ...cur, flagged: !cur.flagged };
        next[idx] = updated;
        persistResponse(idx, updated);
        return next;
      });
    },
    [persistResponse],
  );

  const goToQuestion = useCallback((idx: number) => {
    setCurrentQuestionIdx(idx);
    setIsReviewing(false);
  }, []);

  const goToReview = useCallback(() => setIsReviewing(true), []);
  const exitReview = useCallback(() => setIsReviewing(false), []);

  const answeredCount = responses.filter((r) => r.selected !== null).length;
  const flaggedCount = responses.filter((r) => r.flagged).length;

  return {
    currentQuestionIdx,
    responses,
    remainingSec,
    setAnswer,
    clearAnswer,
    toggleFlag,
    goToQuestion,
    goToReview,
    exitReview,
    isReviewing,
    submitNow,
    submitState,
    errorMessage,
    answeredCount,
    flaggedCount,
  };
}
