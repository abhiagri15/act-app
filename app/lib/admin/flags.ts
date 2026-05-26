import { createAdminClient } from '@/app/lib/supabase/admin';
import type { ActSection } from '@/app/lib/act/format';
import type { FlagReason } from '@/app/lib/feedback/schemas';

export type FlagStatus = 'open' | 'resolved' | 'dismissed';

// One row in the admin /admin/flags list — flag + the question stem + the
// reporter's email, joined in JS (act.question_flags has no RLS policy, so
// service-role reads it directly; the same client reads questions/profiles).
export interface FlagWithQuestion {
  id: string;
  question_id: string;
  user_id: string;
  reason: FlagReason | string;
  notes: string | null;
  status: FlagStatus;
  created_at: string;
  resolved_at: string | null;
  // Joined fields. Defensive against the question or profile having been
  // deleted between the flag write and the admin read (rare; FKs cascade
  // on user/question delete, so this is mostly belt-and-braces).
  question_stem: string;
  question_section: ActSection | null;
  question_enabled: boolean;
  user_email: string | null;
  user_full_name: string | null;
}

// Counts row for the page header.
export interface FlagCounts {
  open: number;
  resolved: number;
  dismissed: number;
}

interface FlagRowRaw {
  id: string;
  user_id: string;
  question_id: string;
  reason: string;
  notes: string | null;
  status: FlagStatus;
  created_at: string;
  resolved_at: string | null;
}

interface QuestionLite {
  id: string;
  stem: string;
  section: ActSection;
  enabled: boolean;
}

interface ProfileLite {
  id: string;
  email: string | null;
  full_name: string | null;
}

// Admin-only. act.question_flags has RLS enabled with NO POLICIES, so reads
// go through the service-role client. Two-step join: fetch flags first,
// then the referenced questions + profiles, merged in JS. Capped at 200.
export async function listFlags(
  status: FlagStatus | 'all' = 'open',
): Promise<FlagWithQuestion[]> {
  const admin = createAdminClient();
  let query = admin
    .schema('act')
    .from('question_flags')
    .select('id, user_id, question_id, reason, notes, status, created_at, resolved_at');
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) {
    console.error('[listFlags] failed:', error);
    return [];
  }
  const rows = data as unknown as FlagRowRaw[];
  if (rows.length === 0) return [];

  const questionIds = [...new Set(rows.map((r) => r.question_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const [qRes, pRes] = await Promise.all([
    admin
      .schema('act')
      .from('questions')
      .select('id, stem, section, enabled')
      .in('id', questionIds),
    admin
      .schema('act')
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds),
  ]);

  const qmap = new Map(
    ((qRes.data ?? []) as unknown as QuestionLite[]).map((q) => [q.id, q]),
  );
  const pmap = new Map(
    ((pRes.data ?? []) as unknown as ProfileLite[]).map((p) => [p.id, p]),
  );

  return rows.map((r) => {
    const q = qmap.get(r.question_id);
    const p = pmap.get(r.user_id);
    return {
      id: r.id,
      question_id: r.question_id,
      user_id: r.user_id,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      question_stem: q?.stem ?? '(question not found)',
      question_section: q?.section ?? null,
      question_enabled: q?.enabled ?? true,
      user_email: p?.email ?? null,
      user_full_name: p?.full_name ?? null,
    };
  });
}

// Open-flag count, for the AdminNav badge + the /admin overview card.
export async function countOpenFlags(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .schema('act')
    .from('question_flags')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if (error) {
    console.error('[countOpenFlags] failed:', error);
    return 0;
  }
  return count ?? 0;
}

// Counts per status, for the /admin/flags page header. Single query that
// fetches the status column and tallies in JS — the table is small.
export async function getFlagCounts(): Promise<FlagCounts> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('question_flags')
    .select('status');
  if (error || !data) {
    console.error('[getFlagCounts] failed:', error);
    return { open: 0, resolved: 0, dismissed: 0 };
  }
  const rows = data as unknown as { status: FlagStatus }[];
  return {
    open: rows.filter((r) => r.status === 'open').length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
    dismissed: rows.filter((r) => r.status === 'dismissed').length,
  };
}
