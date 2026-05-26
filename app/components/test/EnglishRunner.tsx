'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttemptPassage, AttemptQuestion } from '@/app/lib/persistence/schema';
import { PassagePane } from './PassagePane';

interface Props {
  passages: AttemptPassage[];
  questions: AttemptQuestion[];
  currentQuestion: AttemptQuestion | undefined;
  questionPane: React.ReactNode;
  onGoToQuestion: (idx: number) => void;
}

const MIN_PERCENT = 30;
const MAX_PERCENT = 70;

// English-specific runner: passage on the left has interactive `[[N]]`
// markers; clicking one navigates to the corresponding question. The
// passage shown is the one matching the current question's passage_id.
export function EnglishRunner({
  passages,
  questions,
  currentQuestion,
  questionPane,
  onGoToQuestion,
}: Props) {
  const [splitPct, setSplitPct] = useState(60);
  const [isStacked, setIsStacked] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const storageKey = 'act-split-english';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const n = Number(stored);
      if (!Number.isNaN(n) && n >= MIN_PERCENT && n <= MAX_PERCENT) setSplitPct(n);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setIsStacked(window.innerWidth < 768);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const activePassage = currentQuestion?.passage_id
    ? passages.find((p) => p.id === currentQuestion.passage_id) ?? null
    : null;
  const activeMarker = currentQuestion?.passage_marker ?? undefined;

  // Map marker N within the active passage → global question index.
  const onMarkerClick = useCallback(
    (n: number) => {
      if (!activePassage) return;
      const idx = questions.findIndex(
        (q) => q.passage_id === activePassage.id && q.passage_marker === n,
      );
      if (idx >= 0) onGoToQuestion(idx);
    },
    [activePassage, questions, onGoToQuestion],
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, pct));
    setSplitPct(clamped);
  }, []);

  const onPointerUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      try {
        window.localStorage.setItem(storageKey, String(Math.round(splitPct)));
      } catch {
        // ignore
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
  }, [splitPct, onPointerMove]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (isStacked) {
    return (
      <div className="flex h-full flex-col">
        {activePassage && (
          <div className="max-h-[40%] overflow-y-auto border-b">
            <PassagePane
              passage={activePassage}
              activeMarker={activeMarker}
              onMarkerClick={onMarkerClick}
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{questionPane}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div className="overflow-hidden border-r" style={{ width: `${splitPct}%` }}>
        {activePassage ? (
          <PassagePane
            passage={activePassage}
            activeMarker={activeMarker}
            onMarkerClick={onMarkerClick}
          />
        ) : (
          <div className="px-4 py-8 text-sm text-slate-400">No passage.</div>
        )}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        className="w-1.5 cursor-col-resize bg-slate-200 hover:bg-blue-300 active:bg-blue-400"
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{questionPane}</div>
    </div>
  );
}
