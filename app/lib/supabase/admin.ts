import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

// SERVER ONLY. Bypasses RLS. Never import from a 'use client' module —
// Next.js would bundle the service-role key into the browser.
// Used by AI generation (sub-project #3), admin writes (#6), and seed scripts.
export function createAdminClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
