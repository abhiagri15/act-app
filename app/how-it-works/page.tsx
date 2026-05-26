import {
  SECTION_QUESTION_COUNTS,
  SECTION_DURATIONS_SEC,
  BREAK_DURATION_SEC,
} from '@/app/lib/act/format';

export default function HowItWorksPage() {
  const fmt = (sec: number) => `${Math.round(sec / 60)} min`;
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="text-3xl font-semibold">How it works</h1>
      <p className="text-muted-foreground">
        This app simulates the Enhanced ACT (2025+). Each test is a fixed
        sequence of four sections with strict, section-locked timers.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Section</th>
            <th className="text-left py-2">Questions</th>
            <th className="text-left py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">English</td>
            <td>{SECTION_QUESTION_COUNTS.english}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.english)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Math</td>
            <td>{SECTION_QUESTION_COUNTS.math}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.math)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 italic text-muted-foreground">Break</td>
            <td>—</td>
            <td>{fmt(BREAK_DURATION_SEC)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Reading</td>
            <td>{SECTION_QUESTION_COUNTS.reading}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.reading)}</td>
          </tr>
          <tr>
            <td className="py-2">Science (optional)</td>
            <td>{SECTION_QUESTION_COUNTS.science}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.science)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        Composite score 1–36, average of included section scaled scores.
      </p>
    </main>
  );
}
