import type { TrendPoint } from '@/app/lib/analytics/compute';
import { type ActSection, SECTION_ORDER } from '@/app/lib/act/format';

const W = 560;
const H = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 80; // wider on the right for the legend.
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const MIN = 1;
const MAX = 36;

const SECTION_COLORS: Record<ActSection, string> = {
  english: '#2563eb', // blue
  math: '#16a34a', // green
  reading: '#d97706', // amber
  science: '#9333ea', // purple
};

const SECTION_LABELS: Record<ActSection, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

// 4-line SVG chart of per-section scaled scores across attempts.
// Each series is one polyline; gaps (e.g. Science skipped on a no-Science
// attempt) are rendered by breaking the polyline into segments.
export function SectionTrend({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return null;

  // Oldest -> newest for plotting.
  const series = [...trend].reverse();

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number): number =>
    series.length === 1
      ? PAD_LEFT + innerW / 2
      : PAD_LEFT + (i * innerW) / (series.length - 1);
  const y = (score: number): number =>
    PAD_TOP + ((MAX - score) / (MAX - MIN)) * innerH;

  const gridlines = [6, 18, 30, 36];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Per-section scaled score trend"
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

      {SECTION_ORDER.map((section) => {
        const color = SECTION_COLORS[section];

        // Build segments: split the polyline whenever a point is missing.
        // For science, attempts with include_science=false have no scaled
        // score and must produce a gap rather than an interpolated line.
        const segments: Array<Array<{ cx: number; cy: number; score: number }>> = [];
        let cur: Array<{ cx: number; cy: number; score: number }> = [];
        series.forEach((p, i) => {
          const score = p.scaled_scores?.[section];
          const isPresent =
            typeof score === 'number' &&
            (section !== 'science' || p.include_science !== false);
          if (isPresent) {
            cur.push({ cx: x(i), cy: y(score as number), score: score as number });
          } else if (cur.length > 0) {
            segments.push(cur);
            cur = [];
          }
        });
        if (cur.length > 0) segments.push(cur);

        return (
          <g key={section}>
            {segments.map((seg, si) =>
              seg.length > 1 ? (
                <polyline
                  key={si}
                  points={seg.map((s) => `${s.cx},${s.cy}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
              ) : null,
            )}
            {segments.flat().map((s, di) => (
              <circle key={di} cx={s.cx} cy={s.cy} r={3} fill={color} />
            ))}
          </g>
        );
      })}

      {/* Legend (right of the chart). */}
      {SECTION_ORDER.map((section, idx) => (
        <g key={`legend-${section}`}>
          <rect
            x={W - PAD_RIGHT + 8}
            y={PAD_TOP + idx * 20}
            width={10}
            height={10}
            fill={SECTION_COLORS[section]}
          />
          <text
            x={W - PAD_RIGHT + 22}
            y={PAD_TOP + idx * 20 + 9}
            fontSize={11}
            fill="#475569"
          >
            {SECTION_LABELS[section]}
          </text>
        </g>
      ))}

      {/* X-axis attempt indices. */}
      {series.map((_, i) => (
        <text
          key={`xi-${i}`}
          x={x(i)}
          y={H - 8}
          fontSize={10}
          fill="#94a3b8"
          textAnchor="middle"
        >
          {i + 1}
        </text>
      ))}
    </svg>
  );
}
