'use client';

import { useMemo } from 'react';

// passages.stimuli is jsonb with this loose shape:
//   { kind: 'table', caption?, data: [[...]] }
//   { kind: 'figure', caption?, data: { axes?, series? } }
// Rendered dependency-free per spec §5.3. try/catch wraps each item so a
// malformed stimulus doesn't take down the rest of the passage.

interface TableStimulus {
  kind: 'table';
  caption?: string;
  data?: unknown;
}

interface FigureStimulus {
  kind: 'figure';
  caption?: string;
  data?: {
    axes?: { x?: string; y?: string };
    series?: Array<{
      name?: string;
      points?: Array<{ x: number; y: number } | [number, number]>;
    }>;
  };
}

type Stimulus = TableStimulus | FigureStimulus;

function renderTable(s: TableStimulus): React.ReactNode {
  const rows: unknown[] = Array.isArray(s.data) ? (s.data as unknown[]) : [];
  if (rows.length === 0) {
    return <div className="text-xs text-slate-400">(empty table)</div>;
  }
  const [headerRow, ...bodyRows] = rows;
  const headerCells = Array.isArray(headerRow) ? (headerRow as unknown[]) : [];
  return (
    <figure className="my-3">
      <table className="w-full border-collapse text-sm">
        {headerCells.length > 0 && (
          <thead className="bg-slate-50">
            <tr>
              {headerCells.map((cell, i) => (
                <th key={i} className="border border-slate-200 px-2 py-1 text-left font-medium">
                  {String(cell ?? '')}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, ri) => {
            const cells = Array.isArray(row) ? (row as unknown[]) : [];
            return (
              <tr key={ri}>
                {cells.map((cell, ci) => (
                  <td key={ci} className="border border-slate-200 px-2 py-1">
                    {String(cell ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {s.caption && <figcaption className="mt-1 text-xs text-slate-500">{s.caption}</figcaption>}
    </figure>
  );
}

interface PlotPoint {
  x: number;
  y: number;
}

function normalisePoints(raw: Array<{ x: number; y: number } | [number, number]> | undefined): PlotPoint[] {
  if (!raw) return [];
  return raw
    .map((p): PlotPoint | null => {
      if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number') {
        return { x: p[0], y: p[1] };
      }
      if (typeof p === 'object' && p !== null && 'x' in p && 'y' in p) {
        const pp = p as PlotPoint;
        if (typeof pp.x === 'number' && typeof pp.y === 'number') return { x: pp.x, y: pp.y };
      }
      return null;
    })
    .filter((p): p is PlotPoint => p !== null);
}

function renderFigure(s: FigureStimulus): React.ReactNode {
  const series = (s.data?.series ?? []).map((ser) => ({
    name: ser.name ?? '',
    points: normalisePoints(ser.points),
  }));
  const allPoints = series.flatMap((ser) => ser.points);
  if (allPoints.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
        {s.caption ? `(figure: ${s.caption})` : '(figure)'}
      </div>
    );
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const W = 320;
  const H = 200;
  const PAD = 28;
  const sx = (x: number) => PAD + ((x - xMin) / xRange) * (W - PAD * 2);
  const sy = (y: number) => H - PAD - ((y - yMin) / yRange) * (H - PAD * 2);

  const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed'];

  return (
    <figure className="my-3 overflow-x-auto">
      <svg width={W} height={H} className="border border-slate-200">
        {/* Axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#94a3b8" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#94a3b8" />
        {/* Axis labels */}
        {s.data?.axes?.x && (
          <text x={W / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="#475569">
            {s.data.axes.x}
          </text>
        )}
        {s.data?.axes?.y && (
          <text
            x={10}
            y={H / 2}
            fontSize="10"
            textAnchor="middle"
            transform={`rotate(-90 10 ${H / 2})`}
            fill="#475569"
          >
            {s.data.axes.y}
          </text>
        )}
        {/* Min/Max labels */}
        <text x={PAD - 4} y={H - PAD + 12} fontSize="9" textAnchor="end" fill="#64748b">
          {xMin}
        </text>
        <text x={W - PAD} y={H - PAD + 12} fontSize="9" textAnchor="end" fill="#64748b">
          {xMax}
        </text>
        <text x={PAD - 4} y={H - PAD} fontSize="9" textAnchor="end" fill="#64748b">
          {yMin}
        </text>
        <text x={PAD - 4} y={PAD + 4} fontSize="9" textAnchor="end" fill="#64748b">
          {yMax}
        </text>
        {/* Series (lines) */}
        {series.map((ser, si) => {
          const color = COLORS[si % COLORS.length];
          const pts = ser.points;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
          return (
            <g key={si}>
              {path && <path d={path} fill="none" stroke={color} strokeWidth={1.5} />}
              {pts.map((p, i) => (
                <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={color} />
              ))}
            </g>
          );
        })}
        {/* Legend */}
        {series.length > 1 && (
          <g transform={`translate(${W - PAD - 80}, ${PAD - 4})`}>
            {series.map((ser, si) => (
              <g key={si} transform={`translate(0, ${si * 11})`}>
                <rect width={8} height={8} fill={COLORS[si % COLORS.length]} />
                <text x={12} y={8} fontSize="9" fill="#475569">
                  {ser.name || `series ${si + 1}`}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
      {s.caption && <figcaption className="mt-1 text-xs text-slate-500">{s.caption}</figcaption>}
    </figure>
  );
}

function renderOne(item: unknown, index: number): React.ReactNode {
  try {
    if (!item || typeof item !== 'object') return null;
    const s = item as Stimulus;
    if (s.kind === 'table') return <div key={index}>{renderTable(s)}</div>;
    if (s.kind === 'figure') return <div key={index}>{renderFigure(s)}</div>;
    return null;
  } catch (e) {
    console.warn('[StimulusRenderer] failed to render stimulus', index, e);
    return (
      <pre
        key={index}
        className="my-2 overflow-x-auto rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
      >
        {JSON.stringify(item, null, 2)}
      </pre>
    );
  }
}

export function StimulusRenderer({ stimuli }: { stimuli: unknown[] }) {
  const items = useMemo(() => (Array.isArray(stimuli) ? stimuli : []), [stimuli]);
  if (items.length === 0) return null;
  return <div>{items.map(renderOne)}</div>;
}
