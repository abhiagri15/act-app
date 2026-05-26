import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import type { AnalyticsView } from '@/app/lib/analytics/compute';

// Just the profile fields, used by the detail page header.
export interface AdminUserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'student' | 'admin';
  created_at: string;
  updated_at: string;
}

// One row in the admin users list — profile + aggregated stats.
// `avg_composite` and `latest_activity` are null when the user has no
// submitted attempts.
export interface AdminUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: 'student' | 'admin';
  tests_taken: number;
  avg_composite: number | null;
  latest_activity: string | null;
}

// Lists all users with per-user attempt counts, average composite, and last
// activity. Calls the security-definer admin_users_summary RPC, which
// re-checks the caller is an admin before returning anything. The /admin
// layout's requireAdmin() is the first gate; this RPC is the second.
export async function listUsersWithStats(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('act')
    .rpc('admin_users_summary');
  if (error) {
    console.error('[listUsersWithStats] failed:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminUserRow[];
}

// One user's profile by id. Uses the service-role client to bypass RLS on
// act.profiles (whose select policy is scoped to auth.uid()). The /admin
// layout's requireAdmin() already gates this path. Returns null when the
// user does not exist (the page should notFound() on that).
export async function getUserProfileForAdmin(
  id: string,
): Promise<AdminUserProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('act')
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getUserProfileForAdmin] failed:', error);
    return null;
  }
  return (data ?? null) as AdminUserProfile | null;
}

// Per-user analytics view, assembled from the admin_user_analytics RPC.
// The RPC returns the same jsonb shape as act.user_analytics(), so we can
// reuse the existing analytics visual components unchanged.
export async function getUserAnalyticsForAdmin(
  userId: string,
): Promise<AnalyticsView> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('act')
    .rpc('admin_user_analytics', { p_user_id: userId });

  const empty: AnalyticsView = {
    tests_taken: 0,
    latest_composite: null,
    avg_composite: null,
    best_composite: null,
    trend: [],
    sections: {},
    skills: [],
  };

  if (error) {
    console.error('[getUserAnalyticsForAdmin] failed:', error);
    return empty;
  }
  if (data == null) return empty;
  return data as AnalyticsView;
}
