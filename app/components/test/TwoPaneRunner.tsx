'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActSection } from '@/app/lib/act/format';
import type { AttemptPassage, AttemptQuestion } from '@/app/lib/persistence/schema';
import { PassagePane } from './PassagePane';
import { Button } from '@/app/components/ui/button';

interface Props {
  section: ActSection;
  passages: AttemptPassage[];
  currentQuestion: AttemptQuestion | undefined;
  questionPane: React.ReactNode;
}

const MIN_PERCENT = 30;
const MAX_PERCENT = 70;

// Two-pane layout for Reading/Science. Vertical splitter handle drags to
// resize. Persists the split ratio in localStorage per section. Below
// 768px viewport, switches to stacked + sticky "Show passage" toggle.
export function TwoPaneRunner({ section, passages, currentQuestion, questionPane }: Props) {
  const storageKey = `act-split-${section}`;
  const [splitPct, setSplitPct] = useState(60);
  const [isStacked, setIsStacked] = useState(false);
  const [showPassageOnMobile, setShowPassageOnMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Hydrate split ratio from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const n = Number(stored);
      if (!Number.isNaN(n) && n >= MIN_PERCENT && n <= MAX_PERCENT) {
        setSplitPct(n);
      }
    }
  }, [storageKey]);

  // Watch viewport width to switch between two-pane and stacked.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setIsStacked(window.innerWidth < 768);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Find the passage for the current question (if any).
  const activePassage = currentQuestion?.passage_id
    ? passages.find((p) => p.id === currentQuestion.passage_id) ?? null
    : null;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, pct));
      setSplitPct(clamped);
    },
    [],
  );
  const onPointerUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      try {
        window.localStorage.setItem(storageKey, String(Math.round(splitPct)));
      } catch {
        // ignore quota / SSR
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
  }, [splitPct, storageKey, onPointerMove]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (isStacked) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 flex justify-end border-b bg-white px-3 py-1.5">
          {activePassage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPassageOnMobile((v) => !v)}
            >
              {showPassageOnMobile ? 'Show question' : 'Show passage'}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {showPassageOnMobile && activePassage ? (
            <PassagePane passage={activePassage} />
          ) : (
            <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">{questionPane}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div
        className="overflow-hidden border-r"
        style={{ width: `${splitPct}%` }}
      >
        {activePassage ? (
          <PassagePane passage={activePassage} />
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
