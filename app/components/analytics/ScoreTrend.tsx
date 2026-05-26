import type { TrendPoint } from '@/app/lib/analytics/compute';

const W = 560;
const H = 200;
const PAD_LEFT = 32;
const PAD_RIGHT = 16;
const PAD_TOP = 24;
const PAD_BOTTOM = 28;
const MIN = 1;
const MAX = 36;

// Inline-SVG line chart of composite (1-36) across submitted attempts.
// X axis = attempt index (1..N, oldest -> newest). Y axis = composite.
// Plain (non-client) component — props in, SVG out. No charting dependency.
export function ScoreTrend({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return null;

  // The RPC returns newest-first; the chart reads oldest-first.
  const series = [...trend].reverse();

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number): number =>
    series.length === 1
      ? PAD_LEFT + innerW / 2
      : PAD_LEFT + (i * innerW) / (series.length - 1);
  const y = (score: number): number =>
    PAD_TOP + ((MAX - score) / (MAX - MIN)) * innerH;

  const points = series.map((p, i) => ({
    cx: x(i),
    cy: y(p.composite),
    composite: p.composite,
  }));
  const line = points.map((p) => `${p.cx},${p.cy}`).join(' ');

  // Y-axis gridlines at 6 / 18 / 30 / 36 (composite buckets).
  const gridlines = [6, 18, 30, 36];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Composite score trend across attempts"
    >
      {gridlines.map((g) => (
        <g key={g}>
          <line
            x1={PAD_LEFT}
            y1={y(g)}
            x2={W - PAD_RIGHT}
            y2={y(g)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text x={4} y={y(g) + 4} fontSize={10} fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      {points.length > 1 && (
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth={2} />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={4} fill="#2563eb" />
          <text
            x={p.cx}
            y={p.cy - 10}
            fontSize={10}
            fill="#475569"
            textAnchor="middle"
          >
            {p.composite}
          </text>
          <text
            x={p.cx}
            y={H - 8}
            fontSize={10}
            fill="#94a3b8"
            textAnchor="middle"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
