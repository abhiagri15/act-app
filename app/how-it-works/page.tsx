// app/how-it-works/page.tsx
//
// Public-facing explainer for the ACT app. Single fetch site for live pool
// numbers; the Hero and PoolComposition components receive stats as props.
// All other sections are content-only.
//
// ISR: revalidate=3600. The page HTML is regenerated at most once an hour.
// If the pool-stats query fails the page still renders — Hero hides the
// stat strip, PoolComposition shows a "temporarily unavailable" fallback.
//
// The route is in middleware.ts PUBLIC_PATHS, so it is reachable signed-out.

import { getPublicPoolStats } from '@/app/lib/marketing/queries';
import { MarketingHeader } from './_components/MarketingHeader';
import { MarketingFooter } from './_components/MarketingFooter';
import { AnchorNav } from './_components/AnchorNav';
import { Hero } from './_components/Hero';
import { HowItWorks } from './_components/HowItWorks';
import { Parity } from './_components/Parity';
import { QuestionPipeline } from './_components/QuestionPipeline';
import { PoolComposition } from './_components/PoolComposition';
import { WhatYouGet } from './_components/WhatYouGet';
import { FaqAccordion } from './_components/FaqAccordion';
import { CtaFooter } from './_components/CtaFooter';

export const revalidate = 3600;

export const metadata = {
  title: 'How it works — ACT Practice',
  description:
    'Enhanced ACT (2025+) practice with section-locked timers, real 1–36 scoring, and AI-generated content cross-checked by a three-model quality vote.',
};

export default async function HowItWorksPage() {
  const stats = await getPublicPoolStats();

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <AnchorNav />
      <Hero stats={stats} />
      <HowItWorks />
      <Parity />
      <QuestionPipeline />
      <PoolComposition stats={stats} />
      <WhatYouGet />
      <FaqAccordion />
      <CtaFooter />
      <MarketingFooter />
    </div>
  );
}
