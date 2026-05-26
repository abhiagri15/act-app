'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase/server';
import type { ActSection } from '@/app/lib/act/format';
import {
  finalResultsSchema,
  sectionResultSchema,
  submitResponseSchema,
  type FinalResults,
  type SectionResult,
  type SubmitResponse,
} from './schema';

// ---------------------------------------------------------------------------
// Server actions wrapping the security-definer write RPCs added in
// supabase/migrations/20260526030000_act_attempt_rpcs.sql.
//
// Each action:
//   1. Calls the corresponding act.<rpc> via the SSR Supabase client.
//   2. The RPC enforces ownership + state-machine validity itself
//      (security definer, sets user_id := auth.uid()).
//   3. Throws on RPC error; caller is expected to surface the message.
// ---------------------------------------------------------------------------

function fail(action: string, error: { message?: string } | null | undefined): never {
  const msg = error?.message || 'unknown error';
  console.error(`[${action}] rpc error:`, msg);
  throw new Error(msg);
}

// Idempotent. Marks the section started AND sets current_section.
export async function startSection(
  attemptId: string,
  section: ActSection | 'break',
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.schema('act').rpc('start_section', {
    p_attempt: attemptId,
    p_section: section,
  });
  if (error) fail('startSection', error);
}

// Fire-and-forget answer write. Client calls this on every selection/flag
// change. Do not block the UI on this.
export async function upsertResponse(
  attemptId: string,
  questionId: string,
  selected: 'A' | 'B' | 'C' | 'D' | null,
  flagged: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.schema('act').rpc('upsert_response', {
    p_attempt: attemptId,
    p_question: questionId,
    p_selected: selected,
    p_flagged: flagged,
  });
  if (error) fail('upsertResponse', error);
}

// Submit the section with the latest responses; computes raw + scaled and
// marks the section locked. Returns the section result.
export async function submitSection(
  attemptId: string,
  section: ActSection,
  responses: SubmitResponse[],
): Promise<SectionResult> {
  // Defensive zod check — guards a client that bypasses the hook's typing.
  const parsed = submitResponseSchema.array().safeParse(responses);
  if (!parsed.success) {
    throw new Error('invalid responses payload');
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('submit_section', {
    p_attempt: attemptId,
    p_section: section,
    p_responses: parsed.data,
  });
  if (error) fail('submitSection', error);
  const result = sectionResultSchema.safeParse(data);
  if (!result.success) {
    console.error('[submitSection] unexpected rpc shape:', result.error);
    throw new Error('unexpected rpc response');
  }
  return result.data;
}

// Lock the section from whatever's already in attempt_responses. Idempotent
// if already locked.
export async function forceLockSection(
  attemptId: string,
  section: ActSection,
): Promise<SectionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('force_lock_section', {
    p_attempt: attemptId,
    p_section: section,
  });
  if (error) fail('forceLockSection', error);
  const result = sectionResultSchema.safeParse(data);
  if (!result.success) {
    console.error('[forceLockSection] unexpected rpc shape:', result.error);
    throw new Error('unexpected rpc response');
  }
  return result.data;
}

// Validate all required sections are locked, then compute composite and
// mark the attempt 'submitted'. Idempotent.
export async function finalizeAttempt(attemptId: string): Promise<FinalResults> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('finalize_attempt', {
    p_attempt: attemptId,
  });
  if (error) fail('finalizeAttempt', error);
  const result = finalResultsSchema.safeParse(data);
  if (!result.success) {
    console.error('[finalizeAttempt] unexpected rpc shape:', result.error);
    throw new Error('unexpected rpc response');
  }
  // The dashboard lists attempt history; invalidate after finalize.
  revalidatePath('/');
  revalidatePath(`/dashboard/attempts/${attemptId}`);
  return result.data;
}
