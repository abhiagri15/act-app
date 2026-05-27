// app/how-it-works/_components/FaqAccordion.tsx
//
// Native <details>/<summary> accordion. No React state, no client-side JS.
// Keeps the page server-only and accessible by default.

const FAQS = [
  {
    q: 'Is this the real ACT?',
    a: 'No. This is independent practice that mirrors the Enhanced ACT (2025+) format exactly — the same four sections, the same question counts, the same timing, and the same 1–36 scoring scale. It is not affiliated with ACT, Inc.',
  },
  {
    q: 'Are the questions real ACT questions?',
    a: 'No. Every question is AI-generated and then cross-checked by a three-model quality vote (DeepSeek generates, Gemini self-verifies, Gemma tiebreaks). See "How questions are made" above for the full pipeline.',
  },
  {
    q: 'How accurate is my score?',
    a: 'Section scaled scores come from a published Classic ACT raw→scaled table that we rescaled to Enhanced ACT raw counts. Per-form variation on real ACT scales is ±1–2 points, so treat the score as an estimate of where you’d land on a typical form rather than a transcript number.',
  },
  {
    q: 'Can I take the test more than once a day?',
    a: 'There’s a daily attempt cap (default 5 per UTC day). It’s admin-configurable from /admin/settings.',
  },
  {
    q: 'What if I find a bad question?',
    a: 'On the review page after a test (or the saved-attempt review), each question has a flag button. Choose a reason and add an optional comment. Admins triage every flag and disable bad questions from the pool, so they’re never served again.',
  },
  {
    q: 'Is Science optional?',
    a: 'Yes. Enhanced ACT (2025+) made Science optional. There’s a toggle on the pre-test screen. Your composite is then averaged over three sections instead of four.',
  },
  {
    q: 'How is the composite calculated?',
    a: 'It’s the average of the included section scaled scores. Three sections without Science, four with. Rounded to the nearest whole number. Same rule the real ACT uses.',
  },
  {
    q: 'Does this app provide a calculator?',
    a: 'Yes. The Math section has a floating Desmos scientific calculator overlay (bottom-right). Real ACT permits any calculator; we provide one by default.',
  },
  {
    q: 'Why is there no math reference sheet?',
    a: 'Because the real ACT doesn’t provide one. SAT does — ACT doesn’t. We match the test.',
  },
  {
    q: 'Will I get the same question twice?',
    a: 'Not within a single attempt. Across attempts the pool is finite, so high-volume users will eventually see a question again. The generator runs hourly to keep adding new content.',
  },
];

export function FaqAccordion() {
  return (
    <section id="faq" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
      <div className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {FAQS.map((f) => (
          <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-slate-900">
              <span>{f.q}</span>
              <span aria-hidden className="ml-4 text-slate-400 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
