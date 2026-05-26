import { createClient } from '@/app/lib/supabase/server';
import {
  attemptListItemSchema,
  attemptSnapshotSchema,
  type AttemptListItem,
  type AttemptSnapshot,
} from './schema';

// Server-side read helpers wrapping the security-invoker RPCs.
//
// listMyAttempts() — newest first; RLS-scoped to the caller.
// getMyAttempt(id) — full snapshot (passages + questions + responses +
//   section_state). When status='in_progress', answer_key + explanation
//   are stripped at the SQL layer.

export async function listMyAttempts(): Promise<AttemptListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('list_my_attempts');
  if (error) {
    console.error('[listMyAttempts] rpc error:', error.message);
    return [];
  }
  const parsed = attemptListItemSchema.array().safeParse(data ?? []);
  if (!parsed.success) {
    console.error('[listMyAttempts] schema mismatch:', parsed.error);
    return [];
  }
  return parsed.data;
}

export async function getMyAttempt(id: string): Promise<AttemptSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('get_my_attempt', {
    p_id: id,
  });
  if (error) {
    console.error('[getMyAttempt] rpc error:', error.message);
    return null;
  }
  if (data == null) return null;
  const parsed = attemptSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[getMyAttempt] schema mismatch:', parsed.error);
    return null;
  }
  return parsed.data;
}
