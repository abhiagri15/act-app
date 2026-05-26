import Link from 'next/link';
import { listUsersWithStats } from '@/app/lib/admin/users';
import { UserRow } from '@/app/components/admin/UserRow';

export default async function AdminUsersPage() {
  const users = await listUsersWithStats();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Users</h1>
        <Link href="/admin" className="text-sm text-blue-600 underline">
          Back to overview
        </Link>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        {users.length} user{users.length === 1 ? '' : 's'}, most-recently-active
        first. Click a row for per-user analytics.
      </p>

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No users yet.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow key={u.user_id} user={u} />
          ))}
        </div>
      )}
    </main>
  );
}
