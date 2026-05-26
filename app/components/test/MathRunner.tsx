'use client';

// Single-pane Math runner. Centered column with stem + 4 choices.
// No passage, no stimuli.
export function MathRunner({ questionPane }: { questionPane: React.ReactNode }) {
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-4 py-6 sm:px-6">
      {questionPane}
    </div>
  );
}
