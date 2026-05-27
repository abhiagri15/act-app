'use client';

// Floating Desmos scientific calculator panel shown during the ACT Math section.
// The real ACT allows any calculator (including graphing) on the Math section;
// the Desmos scientific embed is the simpler/lighter substitute (one URL, no
// setup) and handles most ACT Math computation. To upgrade to the graphing
// calculator, change the iframe src to https://www.desmos.com/calculator?embed.
//
// Mirrors the SAT app's <CalculatorPanel/> pattern:
//   - self-contained (caller owns the open/closed state)
//   - iframe is only mounted while open => effectively lazy-loaded on first open
//   - z-index above the question pane, sized for a sane bottom/right overlay

interface Props {
  onClose: () => void;
}

export function CalculatorPanel({ onClose }: Props) {
  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[400px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-xl"
      role="dialog"
      aria-label="Calculator"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-medium text-slate-700">Calculator</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          ×
        </button>
      </header>
      <iframe
        src="https://www.desmos.com/scientific?embed"
        loading="lazy"
        title="Desmos Scientific Calculator"
        className="block h-[600px] w-full rounded-b-lg"
      />
    </aside>
  );
}
