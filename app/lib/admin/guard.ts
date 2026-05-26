import { notFound } from 'next/navigation';
import { getOrCreateProfile, type Profile } from '@/app/lib/auth/profile';

// Returns the signed-in user's profile if they are an admin; 404s otherwise.
// Used by the /admin layout AND every admin server action — the gate never
// relies on UI reachability alone. notFound() returns `never`, so the return
// narrows to a non-null admin Profile.
//
// Returns 404 (not 403) deliberately: the /admin area doesn't advertise
// its own existence.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getOrCreateProfile();
  if (!profile || profile.role !== 'admin') notFound();
  return profile;
}
