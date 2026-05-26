import { createClient } from '@/app/lib/supabase/server';
import type { AnalyticsView } from './compute';

// Reads the user's analytics view via the security-invoker
// act.user_analytics() RPC. RLS on test_attempts/attempt_responses
// confines the result to the signed-in user — no client-side scoping needed.
export async function getAnalytics(): Promise<AnalyticsView> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('act').rpc('user_analytics');
  if (error) {
    console.error('[getAnalytics] rpc error:', error.message);
    return emptyView();
  }
  if (data == null) {
    return emptyView();
  }
  return data as AnalyticsView;
}

function emptyView(): AnalyticsView {
  return {
    tests_taken: 0,
    latest_composite: null,
    avg_composite: null,
    best_composite: null,
    trend: [],
    sections: {},
    skills: [],
  };
}
