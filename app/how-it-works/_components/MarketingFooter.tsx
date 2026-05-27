// app/how-it-works/_components/MarketingFooter.tsx
import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-slate-500">
        <span>&copy; 2026 ACT Practice &middot; Not affiliated with ACT, Inc.</span>
        <div className="flex items-center gap-4">
          <a href="#top" className="hover:text-slate-700">Back to top</a>
          <Link href="/login" className="hover:text-slate-700">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
