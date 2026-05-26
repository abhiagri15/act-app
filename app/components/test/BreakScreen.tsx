'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { startSection } from '@/app/lib/persistence/actions';

interface Props {
  attemptId: string;
  endsAt: string;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 10-min break screen. Countdown + "Resume Reading early" button. On
// expiry, automatically transitions to /reading.
export function BreakScreen({ attemptId, endsAt }: Props) {
  const router = useRouter();
  const endsMs = new Date(endsAt).getTime();
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.round((endsMs - Date.now()) / 1000)),
  );
  const [transitioning, setTransitioning] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingSec(Math.max(0, Math.round((endsMs - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [endsMs]);

  const resume = () => {
    if (transitioning) return;
    setTransitioning(true);
    setError(null);
    startTransition(async () => {
      try {
        await startSection(attemptId, 'reading');
        router.push(`/test/${attemptId}/reading`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start Reading section';
        setError(msg);
        setTransitioning(false);
      }
    });
  };

  // Auto-advance on timer expiry.
  useEffect(() => {
    if (remainingSec === 0 && !transitioning) resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, transitioning]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl items-center px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Break</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            Section 2 of 4 complete. Take a 10-minute break, then continue to Reading.
          </p>
          <div
            className="mb-6 text-center font-mono text-5xl font-semibold text-slate-700"
            aria-live="polite"
          >
            {fmtTime(remainingSec)}
          </div>
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button onClick={resume} disabled={transitioning}>
            {transitioning ? 'Loading Reading…' : 'Resume Reading early'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
