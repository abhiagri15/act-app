import Link from 'next/link';
import type { AdminUserRow } from '@/app/lib/admin/users';

function nameFor(user: AdminUserRow): string {
  if (user.full_name) return user.full_name;
  if (user.email) return user.email;
  return `User ${user.user_id.slice(0, 8)}`;
}

function formatActivity(ts: string | null): string {
  if (!ts) return 'never';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleString();
}

// One user row on /admin/users.
export function UserRow({ user }: { user: AdminUserRow }) {
  return (
    <Link
      href={`/admin/users/${user.user_id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-900">{nameFor(user)}</p>
        {user.role === 'admin' && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            Admin
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-600">
        {user.tests_taken} test{user.tests_taken === 1 ? '' : 's'} ·{' '}
        avg composite{' '}
        <span className="font-medium">
          {user.avg_composite == null ? '—' : user.avg_composite}
        </span>{' '}
        · last active {formatActivity(user.latest_activity)}
      </p>
    </Link>
  );
}
