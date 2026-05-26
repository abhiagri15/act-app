import { requireAdmin } from '@/app/lib/admin/guard';
import { AdminNav } from '@/app/components/admin/AdminNav';

// Server component. Gates the entire /admin subtree behind requireAdmin(),
// which 404s non-admins (not 403 — the /admin area does not advertise its
// own existence). Renders the sub-nav above each page.
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
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
