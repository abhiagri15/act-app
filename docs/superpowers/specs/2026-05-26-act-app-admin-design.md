# ACT App — Sub-project #6 (Admin) Design

> Narrower spec built against the overview design. Sub-project #6 delivers the admin-only `/admin` area: question pool moderation, passage moderation, user listing with stats, per-user analytics drill-through, generation_runs log, app settings.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-admin`

---

## 1. Scope

After this lands, an admin user can:
- Hit `/admin` and see an overview dashboard (pool counts, user count, open flags, daily attempt limit)
- Browse the question pool at `/admin/questions` with section/skill/status filters
- Open one question at `/admin/questions/[id]`, toggle `enabled`
- Browse passages at `/admin/passages`; open one, toggle `enabled` (disabling a passage cascade-hides its children questions from draws)
- Browse users at `/admin/users` with attempt count + avg composite + last activity
- Drill into one user's analytics at `/admin/users/[id]` (reuses #5 visuals)
- View the n8n / Vercel cron generation log at `/admin/generation`
- Edit `daily_attempt_limit` at `/admin/settings`

Non-admin users see 404 on every `/admin/*` URL (per SAT precedent: 404 not 403 — admin surface doesn't advertise itself).

**In scope:**
- `requireAdmin()` helper at `app/lib/admin/guard.ts`
- `/admin/layout.tsx` with `requireAdmin()` gate + `<AdminNav/>`
- 8 admin pages (overview, questions list, question detail, passages list, passage detail, users list, user detail, generation log, settings)
- 3 server actions: `setQuestionEnabled`, `setPassageEnabled`, `setDailyAttemptLimit`
- 2 admin RPCs: `act.admin_users_summary()`, `act.admin_user_analytics(p_user)` — both internal-role-check + `security definer`
- `act.app_config` single-row table for runtime settings
- The existing `act.draw_test` RPC is amended to read `daily_attempt_limit` from `act.app_config` and to count today's attempts (reject if at cap)

**Out of scope:**
- Question/passage create/edit forms (deferred; admins disable bad ones, the AI generates new ones)
- Bulk operations (deferred)
- Audit log (deferred — generation_runs gives partial visibility)
- Flag UI (sub-project #7)

---

## 2. RPCs and Table

### `act.app_config` (new table)

```sql
create table if not exists act.app_config (
  id integer primary key default 1 check (id = 1), -- single-row table
  daily_attempt_limit integer not null default 5 check (daily_attempt_limit > 0),
  updated_at timestamptz not null default now()
);
insert into act.app_config (id) values (1) on conflict do nothing;

alter table act.app_config enable row level security;
-- Readable by authenticated (the daily limit isn't secret); writable only via service-role.
create policy "app_config_select_authenticated" on act.app_config
  for select to authenticated using (true);
grant select on act.app_config to authenticated;

create trigger app_config_set_updated_at
  before update on act.app_config
  for each row execute function act.set_updated_at();
```

### `act.admin_users_summary()` (security definer, role-checked)

Returns one row per signed-up user with attempt count, avg composite, last activity. Role check at the SQL layer raises if caller isn't admin.

```sql
create or replace function act.admin_users_summary()
returns table (
  user_id uuid, email text, full_name text, role text,
  tests_taken int, avg_composite numeric, latest_activity timestamptz
)
language plpgsql security definer set search_path = act, public, pg_temp
as $$
begin
  if (select role from act.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'not authorized';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role,
           count(a.id)::int as tests_taken,
           avg(a.composite)::numeric(4,1) as avg_composite,
           greatest(p.updated_at, max(a.submitted_at)) as latest_activity
    from act.profiles p
    left join act.test_attempts a on a.user_id = p.id and a.status = 'submitted'
    group by p.id
    order by latest_activity desc nulls last;
end;
$$;
```

### `act.admin_user_analytics(p_user uuid)` (security definer, role-checked)

Same payload shape as `act.user_analytics()` but for the specified user.

```sql
create or replace function act.admin_user_analytics(p_user uuid)
returns jsonb language plpgsql security definer set search_path = act, public, pg_temp
as $$
declare v_result jsonb;
begin
  if (select role from act.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'not authorized';
  end if;
  -- Body mirrors act.user_analytics() but filters by p_user instead of auth.uid().
  -- ... (full SQL in plan)
  return v_result;
end;
$$;
```

### Amend `act.draw_test` (daily cap enforcement)

Add at the top of the function body, after the auth.uid() check:

```sql
declare v_today_count int; v_limit int;
begin
  ...existing...
  select daily_attempt_limit into v_limit from act.app_config where id = 1;
  select count(*) into v_today_count from act.test_attempts
    where user_id = v_user_id
      and started_at >= date_trunc('day', now() at time zone 'utc')
      and status in ('in_progress', 'submitted');
  if v_today_count >= v_limit then
    raise exception 'daily_attempt_limit reached (% / %)', v_today_count, v_limit;
  end if;
  ...existing pool checks...
```

The redefined function lives in the same migration that adds `app_config`.

---

## 3. File Structure

```
app/
├── (app)/admin/
│   ├── layout.tsx                    requireAdmin() + <AdminNav/>
│   ├── page.tsx                      Overview (4 stat cards + links)
│   ├── questions/
│   │   ├── page.tsx                  list + filters + QuestionRow
│   │   └── [id]/page.tsx             detail + enable/disable form
│   ├── passages/
│   │   ├── page.tsx                  list + filters + PassageRow
│   │   └── [id]/page.tsx             detail + enable/disable form
│   ├── users/
│   │   ├── page.tsx                  list + UserRow
│   │   └── [id]/page.tsx             per-user analytics (reuses #5)
│   ├── generation/page.tsx           generation_runs log
│   └── settings/page.tsx             daily_attempt_limit form
├── components/admin/
│   ├── AdminNav.tsx                  'use client'; sub-nav with active highlight
│   ├── QuestionRow.tsx               metadata + enable/disable form
│   ├── PassageRow.tsx                metadata + enable/disable form
│   ├── UserRow.tsx                   stats
│   └── GenerationRunRow.tsx          one row from act.generation_runs
└── lib/
    ├── admin/
    │   ├── guard.ts                  requireAdmin() server helper
    │   ├── queries.ts                listQuestions, getQuestion, listPassages, getPassage, getPoolCounts, listGenerationRuns
    │   ├── users.ts                  listUsersWithStats, getUserProfileForAdmin, getUserAnalyticsForAdmin
    │   ├── flags.ts                  EMPTY for now; sub-project #7 fills it
    │   └── actions.ts                'use server'; setQuestionEnabled, setPassageEnabled, setDailyAttemptLimit
    └── config.ts                     getDailyLimit() helper for non-admin use (used by the "Start full test" CTA gate)

supabase/migrations/20260526050000_act_admin_rpcs.sql        app_config table + 2 admin RPCs + draw_test amendment
```

---

## 4. RequireAdmin pattern

```ts
// app/lib/admin/guard.ts
import { notFound } from 'next/navigation';
import { getOrCreateProfile } from '@/app/lib/auth/profile';

export async function requireAdmin() {
  const profile = await getOrCreateProfile();
  if (!profile || profile.role !== 'admin') notFound();
  return profile;
}
```

- Called by `/admin/layout.tsx` (gates the whole subtree)
- ALSO called by every admin server action (`setQuestionEnabled`, etc.) — UI gating is never the security gate
- Returns 404 (`notFound()`), NOT 403 — admin surface doesn't advertise itself
- Used by `<AppHeader/>` to conditionally show the "/admin" nav link (only for admins)

---

## 5. Admin Writes via Service-Role

`sat.questions` (and now `act.questions`) is RLS write-locked — anon/authenticated cannot write. Admin writes go through the service-role client behind `requireAdmin()`:

```ts
// app/lib/admin/actions.ts
'use server';
import { requireAdmin } from './guard';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function setQuestionEnabled(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id')?.toString();
  const enabled = formData.get('enabled') === 'true';
  if (!id) return;
  const supabase = createAdminClient();
  await supabase.schema('act').from('questions').update({ enabled }).eq('id', id);
  revalidatePath('/admin/questions');
  revalidatePath(`/admin/questions/${id}`);
}
// Same shape for setPassageEnabled, setDailyAttemptLimit.
```

---

## 6. Sub-project boundaries

**What #7 (Feedback) gets from #6:**
- `requireAdmin()` helper exists and is used
- `<AdminNav/>` has a placeholder slot for "Open Flags" (added in #7)
- `app/lib/admin/flags.ts` exists (empty) — #7 fills it

**What this does NOT do:**
- Flag review UI (#7)
- AppHeader integration with `/admin` link (BUT lift it now: AppHeader reads the profile and conditionally shows "/admin" link for admins)
- Any AI generation triggering — admin can only inspect, not trigger

---

## 7. Promoting a user to admin

There is no admin UI for promotion. Per the SAT precedent and the role-escalation guard trigger, promotion is done by direct SQL as `service_role`:

```sql
update act.profiles set role = 'admin' where id = '<uuid>';
```

Documented in CLAUDE.md.

---

## 8. References

- Overview spec §7 #6
- SAT precedent: `Personal/satpracticereact/sat-app/app/(app)/admin/`, `app/lib/admin/`, `app/components/admin/`
