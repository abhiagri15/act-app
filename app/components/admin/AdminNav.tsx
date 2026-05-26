'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sub-nav shown on every /admin page (rendered by the admin layout).
// Highlights the active section. Lives as a client component because the
// active-tab logic needs the current pathname.
//
// The "Open Flags" tab is added by sub-project #7 (Feedback).

interface Tab {
  label: string;
  href: string;
  // /admin matches only the exact path; the others match path === href OR
  // path starting with href + '/' so detail routes still light up the tab
  // (e.g. /admin/questions/<id> highlights "Question Pool").
  exact?: boolean;
}

const TABS: Tab[] = [
  { label: 'Overview', href: '/admin', exact: true },
  { label: 'Question Pool', href: '/admin/questions' },
  { label: 'Passages', href: '/admin/passages' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Generation', href: '/admin/generation' },
  { label: 'Settings', href: '/admin/settings' },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(tab.href + '/');
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 py-2 sm:px-6">
        {TABS.map((t) => {
          const active = isActive(pathname, t);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
