import { requireAdmin } from '@/app/lib/admin/guard';
import { AdminNav } from '@/app/components/admin/AdminNav';
import { countOpenFlags } from '@/app/lib/admin/flags';

// Server component. Gates the entire /admin subtree behind requireAdmin(),
// which 404s non-admins (not 403 — the /admin area does not advertise its
// own existence). Renders the sub-nav above each page.
//
// AdminNav is a client component, so it can't run server queries directly.
// We fetch the open-flag count here and pass it as a prop for the badge.
//
// UI gating is never the security gate: every admin server action calls
// requireAdmin() again before it writes. This layout's check is the first
// of two layers.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const openFlagCount = await countOpenFlags();
  return (
    <>
      <AdminNav openFlagCount={openFlagCount} />
      {children}
    </>
  );
}
