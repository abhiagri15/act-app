import { getMyAttempt } from '@/app/lib/persistence/queries';
import { forceLockSection } from '@/app/lib/persistence/actions';
import type { ActSection } from '@/app/lib/act/format';
import type { AttemptSnapshot, SectionStateEntry } from '@/app/lib/persistence/schema';

// Per-section URL guard. Validates that:
// - the attempt exists + is in-progress
// - URL segment matches current_section (otherwise redirect)
// - if section is locked OR deadline-passed, force-lock and advance.
//
// Returns either { status: 'ok', snapshot } or { status: 'redirect', href }.
// The page component switches on this.
export async function guardSectionRoute(
  attemptId: string,
  routeSection: ActSection | 'break',
): Promise<
  | { status: 'ok'; snapshot: AttemptSnapshot }
  | { status: 'redirect'; href: string }
> {
  const snapshot = await getMyAttempt(attemptId);
  if (!snapshot) return { status: 'redirect', href: '/' };
  if (snapshot.status === 'submitted') {
    return { status: 'redirect', href: `/dashboard/attempts/${attemptId}` };
  }
  if (snapshot.status === 'abandoned') {
    return { status: 'redirect', href: '/' };
  }

  const cur = snapshot.current_section;
  // First-mount of english: cur is null. Allowed.
  if (cur !== null && cur !== routeSection) {
    return { status: 'redirect', href: `/test/${attemptId}/${cur}` };
  }

  // If we're on the current section, check lock + deadline.
  if (cur === routeSection) {
    const stateMap = snapshot.section_state as Record<string, SectionStateEntry | undefined>;
    const sectionEntry = stateMap[cur];
    if (sectionEntry?.locked) {
      return { status: 'redirect', href: nextSectionHref(attemptId, cur, snapshot.include_science) };
    }
    if (sectionEntry?.ends_at && routeSection !== 'break') {
      const endsMs = new Date(sectionEntry.ends_at).getTime();
      if (Date.now() > endsMs + 10_000) {
        try {
          await forceLockSection(attemptId, routeSection as ActSection);
        } catch (e) {
          console.error('[guardSectionRoute] forceLockSection failed:', e);
        }
        return { status: 'redirect', href: nextSectionHref(attemptId, cur, snapshot.include_science) };
      }
    }
  }

  return { status: 'ok', snapshot };
}

export function nextSectionHref(
  attemptId: string,
  from: ActSection | 'break',
  includeScience: boolean,
): string {
  const order: Array<ActSection | 'break'> = ['english', 'math', 'break', 'reading'];
  if (includeScience) order.push('science');
  const idx = order.indexOf(from);
  if (idx === -1 || idx === order.length - 1) {
    return `/test/${attemptId}/results`;
  }
  // order[idx+1] is guaranteed to exist since we checked idx !== last
  return `/test/${attemptId}/${order[idx + 1] as ActSection | 'break'}`;
}
