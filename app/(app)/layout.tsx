import { getOrCreateProfile } from '@/app/lib/auth/profile';
import { AppHeader } from '@/app/components/AppHeader';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Side effect: lazily creates act.profiles row on first authenticated request.
  // Wrapped in cache() so this AND <AppHeader/> below collapse to one DB call.
  await getOrCreateProfile();
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
