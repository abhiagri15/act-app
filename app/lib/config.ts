import { createClient } from '@/app/lib/supabase/server';

// Reads the app-wide daily test-attempt limit from act.app_config. The table
// is RLS-readable by authenticated callers (no write policy — writes go
// through the service-role client behind requireAdmin()). Returns the
// default (5) when the row is missing or the query errors, so the gate is
// fail-safe (the airtight backstop is act.draw_test's own re-check).
export async function getDailyLimit(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('act')
    .from('app_config')
    .select('daily_attempt_limit')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[getDailyLimit] failed:', error.message);
    return 5;
  }
  return (data?.daily_attempt_limit as number | undefined) ?? 5;
}
