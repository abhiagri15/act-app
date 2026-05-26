'use server';

import { createClient } from '@/app/lib/supabase/server';
import { submitFlagSchema, type SubmitFlagInput } from './schemas';

export type SubmitFlagResult = { ok: true; id: string } | { ok: false; error: string };

// Files a user-reported problem with a pool question. Validates input,
// then calls the act.submit_flag security-definer RPC (which sets user_id
// from auth.uid() and enforces the reason whitelist at the SQL layer).
//
// act.question_flags has RLS enabled with NO POLICIES — this RPC is the
// only write path available to authenticated users.
export async function submitFlag(input: SubmitFlagInput): Promise<SubmitFlagResult> {
  const parsed = submitFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Please choose a reason.' };
  }
  const { question_id, reason, notes } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('act')
    .rpc('submit_flag', {
      p_question: question_id,
      p_reason: reason,
      p_notes: notes ?? null,
    });
  if (error) {
    console.error('[submitFlag] failed:', error);
    return { ok: false, error: 'Could not submit the report. Please try again.' };
  }
  return { ok: true, id: data as string };
}
