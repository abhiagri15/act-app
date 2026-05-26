import Link from 'next/link';
import { getOrCreateProfile } from '@/app/lib/auth/profile';
import { signOut } from '@/app/lib/auth/actions';
import { Button } from '@/app/components/ui/button';

// Server component. Rendered on every (app)/ page via (app)/layout.tsx.
// Reads from the cache()-wrapped getOrCreateProfile so the layout's
// implicit read and this header's read collapse to one DB call per request.
// Shows the /admin link only when the profile.role is 'admin'.
export async function AppHeader() {
  const profile = await getOrCreateProfile();
  const displayName = profile?.full_name || profile?.email || 'Student';
  const isAdmin = profile?.role === 'admin';
  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-2.5 sm:px-5">
      <nav className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          ACT Practice
        </Link>
        <Link
          href="/analytics"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          Analytics
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            Admin
          </Link>
        )}
        <Link
          href="/how-it-works"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          How it works
        </Link>
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{displayName}</span>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
