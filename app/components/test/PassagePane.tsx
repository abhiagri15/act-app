'use client';

import { useMemo } from 'react';
import type { AttemptPassage } from '@/app/lib/persistence/schema';
import { StimulusRenderer } from './StimulusRenderer';

interface Props {
  passage: AttemptPassage;
  // For English passages: the active marker number (highlights that marker).
  activeMarker?: number;
  // For English passages: click handler on a marker.
  onMarkerClick?: (marker: number) => void;
}

// Parses the passage body for `[[N]]` tokens (English passages) into
// rendered marker spans. Non-English passages render plain prose.
function parseEnglishBody(
  body: string,
  activeMarker: number | undefined,
  onMarkerClick: ((marker: number) => void) | undefined,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[\[(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`t-${key++}`}>{body.slice(last, m.index)}</span>);
    }
    const n = Number(m[1]);
    const active = activeMarker === n;
    parts.push(
      <button
        key={`m-${n}`}
        type="button"
        onClick={() => onMarkerClick?.(n)}
        className={`mx-0.5 inline-flex items-center rounded px-1 align-middle text-xs font-semibold ${
          active
            ? 'bg-blue-500 text-white ring-2 ring-blue-300'
            : 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
        }`}
      >
        {n}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    parts.push(<span key={`t-${key++}`}>{body.slice(last)}</span>);
  }
  return parts;
}

export function PassagePane({ passage, activeMarker, onMarkerClick }: Props) {
  const isEnglish = passage.section === 'english';
  const body = useMemo(() => {
    if (isEnglish) {
      return parseEnglishBody(passage.body, activeMarker, onMarkerClick);
    }
    return passage.body;
  }, [isEnglish, passage.body, activeMarker, onMarkerClick]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
      {passage.title && (
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {passage.title}
        </h3>
      )}
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {body}
      </div>
      <StimulusRenderer stimuli={passage.stimuli ?? []} />
    </div>
  );
}
