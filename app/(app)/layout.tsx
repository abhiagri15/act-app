import { getOrCreateProfile } from '@/app/lib/auth/profile';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Side effect: lazily creates act.profiles row on first authenticated request.
  // Result is currently unused at the layout level (no header yet);
  // sub-project #4 will introduce <AppHeader/> here and read the profile.
  await getOrCreateProfile();
  return <>{children}</>;
}
