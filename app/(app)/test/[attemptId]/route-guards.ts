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
  const stateMap = snapshot.section_state as Record<string, SectionStateEntry | undefined>;

  // On the section the attempt currently points at: enforce lock + deadline.
  if (cur === routeSection) {
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
    return { status: 'ok', snapshot };
  }

  // Fresh attempt — nothing started yet. English is the only valid entry.
  if (cur === null) {
    if (routeSection === 'english') return { status: 'ok', snapshot };
    return { status: 'redirect', href: `/test/${attemptId}/english` };
  }

  // cur differs from the requested route. submit_section locks a section but
  // does NOT advance current_section, and the break is never locked. So when
  // the current section is "finished" — a locked content section, or the
  // break the user just left — allow forward navigation to the immediately
  // next section; the page's startSection() then advances current_section.
  // This is what breaks the english<->math (and break<->reading) redirect loop.
  const curFinished = cur === 'break' || stateMap[cur]?.locked === true;
  const expectedNextHref = nextSectionHref(attemptId, cur, snapshot.include_science);
  const requestedHref = `/test/${attemptId}/${routeSection}`;

  if (curFinished) {
    // Legitimate forward step → let startSection() take over. Any other
    // target (skip / back to a locked section) → send them to the next one.
    return expectedNextHref === requestedHref
      ? { status: 'ok', snapshot }
      : { status: 'redirect', href: expectedNextHref };
  }

  // Current section is still active (unlocked) — force the user back to it.
  return { status: 'redirect', href: `/test/${attemptId}/${cur}` };
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
