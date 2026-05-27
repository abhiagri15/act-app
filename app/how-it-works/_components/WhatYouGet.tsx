// app/how-it-works/_components/WhatYouGet.tsx
const CARDS = [
  {
    title: 'Real Enhanced ACT pacing',
    body: 'Full timed tests with section-locked timers and the 10-minute mandatory break. The runner mirrors the real digital format — inline [[N]] markers on English, two-pane on Reading and Science.',
  },
  {
    title: 'Per-skill analytics',
    body: 'Composite trend over time, per-section trend and accuracy, focus areas, and a per-skill breakdown. Empty state until you finish your first test.',
  },
  {
    title: 'Attempt review',
    body: 'Every past attempt opens to a full review: each question, your answer, the correct answer, and the explanation. Grouped by section and passage.',
  },
  {
    title: 'Flag bad questions',
    body: 'Anything that looks off — ambiguous, multiple valid answers, broken figure — gets a flag button on the review page. Admins triage every flag and disable bad questions from the pool.',
  },
  {
    title: 'Fresh content, every hour',
    body: 'The n8n generator runs hourly; a Vercel daily cron backs it up. The pool keeps growing without you doing anything.',
  },
  {
    title: 'Calculator on Math',
    body: 'A floating Desmos scientific calculator sits in the bottom-right of the Math section. Toggle it on or off; it disappears when you move to Reading.',
  },
];

export function WhatYouGet() {
  return (
    <section id="what-you-get" className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900">What you get</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
