// app/how-it-works/_components/AnchorNav.tsx
//
// Non-sticky inline anchor links so visitors can jump straight to the
// section that matters to them (test flow, parity, methodology, pool, FAQ).
export function AnchorNav() {
  return (
    <nav className="mx-auto max-w-5xl px-6 pt-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <li><a href="#how-it-works" className="hover:text-blue-600">How a test runs</a></li>
        <li><a href="#why-its-close" className="hover:text-blue-600">Why it&apos;s close to the real ACT</a></li>
        <li><a href="#methodology" className="hover:text-blue-600">How questions are made</a></li>
        <li><a href="#pool" className="hover:text-blue-600">Live pool</a></li>
        <li><a href="#what-you-get" className="hover:text-blue-600">What you get</a></li>
        <li><a href="#faq" className="hover:text-blue-600">FAQ</a></li>
      </ul>
    </nav>
  );
}
