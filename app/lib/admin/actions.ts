'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from './guard';
import { createAdminClient } from '@/app/lib/supabase/admin';

// Enable or disable a pool question. Admin-only. act.questions is RLS
// write-locked, so the write goes through the service-role client; a disabled
// question is excluded by act.draw_test and never served again.
export async function setQuestionEnabled(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id')?.toString();
  const enabled = formData.get('enabled') === 'true';
  if (!id) {
    throw new Error('setQuestionEnabled: missing id');
  }
  const admin = createAdminClient();
  const { error } = await admin
    .schema('act')
    .from('questions')
    .update({ enabled })
    .eq('id', id);
  if (error) {
    console.error('[setQuestionEnabled] failed:', error);
    throw new Error('Failed to update the question.');
  }
  revalidatePath('/admin');
  revalidatePath('/admin/questions');
  revalidatePath(`/admin/questions/${id}`);
}

// Enable or disable a passage. Disabling cascade-hides its children questions
// from new draws: act.draw_test only picks enabled passages, and the
// question-build step joins through the picked set. Behind requireAdmin().
export async function setPassageEnabled(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id')?.toString();
  const enabled = formData.get('enabled') === 'true';
  if (!id) {
    throw new Error('setPassageEnabled: missing id');
  }
  const admin = createAdminClient();
  const { error } = await admin
    .schema('act')
    .from('passages')
    .update({ enabled })
    .eq('id', id);
  if (error) {
    console.error('[setPassageEnabled] failed:', error);
    throw new Error('Failed to update the passage.');
  }
  revalidatePath('/admin');
  revalidatePath('/admin/passages');
  revalidatePath(`/admin/passages/${id}`);
}

// Marks a question flag resolved or dismissed. Admin-only.
// act.question_flags has RLS enabled with NO POLICIES, so the update runs
// through the service-role client. requireAdmin() is the authorization gate.
// Both `resolved` and `dismissed` are terminal states; `resolved_at` is
// stamped so the timeline is visible in the admin UI.
export async function resolveFlag(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id')?.toString();
  const status = formData.get('status')?.toString();
  if (!id) {
    throw new Error('resolveFlag: missing id');
  }
  if (status !== 'resolved' && status !== 'dismissed') {
    throw new Error(`resolveFlag: invalid status: ${status}`);
  }
  const admin = createAdminClient();
  const { error } = await admin
    .schema('act')
    .from('question_flags')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[resolveFlag] failed:', error);
    throw new Error('Failed to update the flag.');
  }
  revalidatePath('/admin');
  revalidatePath('/admin/flags');
}

// Update the question-pool floor gates (act.app_config). Admin-only; writes
// via the service-role client (app_config has no write policy). runGeneration()
// re-reads the floors on every run.
//
// skill range: 0..50 (matches the SQL CHECK constraint).
// passage range: 0..20.
export async function setFloorConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const skill = Number.parseInt(
    String(formData.get('min_skill_floor') ?? ''),
    10,
  );
  const passage = Number.parseInt(
    String(formData.get('min_passage_floor') ?? ''),
    10,
  );
  if (!Number.isInteger(skill) || skill < 0 || skill > 50) {
    throw new Error('Skill floor must be a whole number between 0 and 50.');
  }
  if (!Number.isInteger(passage) || passage < 0 || passage > 20) {
    throw new Error('Passage floor must be a whole number between 0 and 20.');
  }
  const admin = createAdminClient();
  const { error } = await admin
    .schema('act')
    .from('app_config')
    .update({
      min_skill_floor: skill,
      min_passage_floor: passage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    console.error('[setFloorConfig] failed:', error);
    throw new Error('Failed to update the floor configuration.');
  }
  revalidatePath('/admin');
  revalidatePath('/admin/settings');
  revalidatePath('/admin/floor-status');
}

// Update the app-wide daily test-attempt limit (act.app_config). Admin-only;
// writes via the service-role client (app_config has no write policy).
// act.draw_test re-reads the limit on every call.
export async function setDailyAttemptLimit(formData: FormData): Promise<void> {
  await requireAdmin();
  const limit = Number(formData.get('limit'));
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Daily limit must be a whole number between 1 and 100.');
  }
  const admin = createAdminClient();
  const { error } = await admin
    .schema('act')
    .from('app_config')
    .update({ daily_attempt_limit: limit, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('[setDailyAttemptLimit] failed:', error);
    throw new Error('Failed to update the daily limit.');
  }
  revalidatePath('/admin');
  revalidatePath('/admin/settings');
}
