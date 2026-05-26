# ACT App — Sub-project #2 (Auth) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver verbatim-mirror-of-SAT email + password + Google OAuth auth flow on top of Foundation. After this lands and is tagged `post-auth`, unauthenticated visitors land on `/login`, authenticated users land on `/`, and `act.profiles` rows are lazily created on first sign-in.

**Spec:** `docs/superpowers/specs/2026-05-26-act-app-auth-design.md`

**Reference codebase:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\satpracticereact\sat-app\` — files marked "mirror SAT verbatim" must be byte-for-byte identical (only `sat` → `act` schema substitution + branding strings in `(auth)/layout.tsx`).

**Working directory for ALL commands:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

**Shell conventions:**
- ` ```bash ` blocks run via the Bash tool (POSIX syntax works).
- ` ```powershell ` blocks run via the PowerShell tool.

---

## Task 1: Foundation tech-debt cleanup migration

**Files:**
- Create: `supabase/migrations/20260526010000_act_foundation_followups.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Sub-project #2 (Auth) pre-flight: clears Supabase advisor warnings
-- from Foundation. No schema changes — just function security posture.

-- 1. protect_profile_role: gratuitously SECURITY DEFINER. Trigger context
-- doesn't need elevated privileges. Match sat.protect_profile_role posture.
alter function act.protect_profile_role() security invoker;
revoke execute on function act.protect_profile_role() from public;

-- 2. set_updated_at: lock search_path against extension shadowing.
alter function act.set_updated_at() set search_path = act, pg_temp;

-- 3. passages_fill_defaults: lock search_path. Uses digest() from pgcrypto,
-- which lives in public, so include public in the path.
alter function act.passages_fill_defaults() set search_path = act, public, pg_temp;

-- 4. questions_fill_defaults: same.
alter function act.questions_fill_defaults() set search_path = act, public, pg_temp;
```

- [ ] **Step 2: Apply via Supabase MCP**

Tool: `mcp__claude_ai_Supabase__apply_migration`
- `project_id`: `falgykkspbtrwdcchayi`
- `name`: `act_foundation_followups`
- `query`: (the SQL above)

- [ ] **Step 3: Verify the advisor warnings cleared**

Use Supabase MCP `get_advisors` with `project_id=falgykkspbtrwdcchayi` and `type=security`. The four warnings (`anon_security_definer_function_executable`, `authenticated_security_definer_function_executable`, plus 3 `function_search_path_mutable` for the `act` schema functions) should no longer appear.

If `get_advisors` isn't available, run via `execute_sql`:
```sql
select n.nspname, p.proname, p.prosecdef as security_definer,
       (select array_to_string(p.proconfig, ',')) as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'act';
```
Expected: `protect_profile_role` has `security_definer=false` and `config` containing `search_path=…` is empty for it (the function-level setting is on the other three). All three `_fill_defaults`/`set_updated_at` functions have `search_path` in their `config`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526010000_act_foundation_followups.sql
git commit -m "feat(auth): clear Foundation advisor warnings via posture fixes"
```

---

## Task 2: Auth zod schemas

**Files:**
- Create: `app/lib/auth/schemas.ts`

- [ ] **Step 1: Write the file (verbatim from SAT)**

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Name is required'),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: Verify `pnpm type-check` exits 0.**

---

## Task 3: Profile helper + signOut action

**Files:**
- Create: `app/lib/auth/profile.ts`
- Create: `app/lib/auth/actions.ts`

- [ ] **Step 1: Write `app/lib/auth/profile.ts`**

```ts
import { cache } from 'react';
import { createClient } from '@/app/lib/supabase/server';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'student' | 'admin';
  created_at: string;
  updated_at: string;
}

// Returns the signed-in user's act.profiles row, creating it on first access.
// Wrapped in cache() so the layout's profile read and any page reads collapse
// to a single execution per request. Requires the `act` schema to be exposed
// in Supabase API settings (already done in Foundation Task 16).
export const getOrCreateProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const act = supabase.schema('act');

  const { data: existing } = await act
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) return existing as Profile;

  const meta = user.user_metadata ?? {};
  const { data: created, error } = await act
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: meta.full_name ?? meta.name ?? null,
      avatar_url: meta.avatar_url ?? null,
    })
    .select('*')
    .single();

  if (error) {
    // A concurrent first-load may have inserted the row; re-select.
    // Log non-race failures (e.g. the `act` schema not exposed in Supabase
    // API settings) — they would otherwise be silently invisible.
    console.error('[getOrCreateProfile] insert failed, re-selecting:', error.message);
    const { data: row } = await act
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    return (row as Profile) ?? null;
  }
  return created as Profile;
});
```

- [ ] **Step 2: Write `app/lib/auth/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';

// Server action: clears the Supabase session cookie and returns to /login.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 3: Verify `pnpm type-check` exits 0.**

---

## Task 4: OAuth callback route

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Write the file (verbatim from SAT)**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Exchanges the OAuth / email-link `code` for a session, then redirects
// into the app. Used by Google sign-in and the password-reset email link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  // Only allow same-origin absolute paths; reject protocol-relative (//host).
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: Verify `pnpm type-check` exits 0.**

---

## Task 5: `(auth)` route group + layout + login page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Write `(auth)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Enhanced ACT · Practice
          </span>
          <h1 className="mt-3 text-2xl font-semibold">ACT Practice Test</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the LoginForm client component**

Read SAT's `app/(auth)/login/page.tsx` and `LoginForm.tsx` (whichever holds the form logic). Mirror the implementation: react-hook-form + zod via `@hookform/resolvers/zod` + `loginSchema`. Submit calls `supabase.auth.signInWithPassword`. Google button calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` }})`. On success, `router.push('/')` and `router.refresh()`. Errors render inline above the submit button.

The component file name pattern: SAT uses a single `page.tsx` that defines the client component inline OR separate `LoginForm.tsx`. Match whichever pattern SAT uses. If SAT inlines the form into `page.tsx`, do the same. If SAT extracts to a separate file, do the same.

- [ ] **Step 3: Write the login page (server component) that renders the LoginForm**

If SAT inlines, the page IS the form. If SAT extracts, the page is a thin wrapper that returns `<LoginForm />`.

- [ ] **Step 4: Verify `pnpm type-check` exits 0 and `pnpm build` succeeds.**

---

## Task 6: Register, forgot-password, reset-password pages

**Files:**
- Create: `app/(auth)/register/page.tsx` (+ form component if SAT separates them)
- Create: `app/(auth)/forgot-password/page.tsx` (+ form)
- Create: `app/(auth)/reset-password/page.tsx` (+ form)

For each page, follow the SAT pattern verbatim. The auth-client calls map to:

| Page | Action on submit | Behavior |
|------|------------------|----------|
| `/register` | `signUp({ email, password, options: { data: { full_name }, emailRedirectTo: `${origin}/auth/callback` }})` | Render "Check your email" panel on success |
| `/forgot-password` | `resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })` | Render "Check your email" panel on success |
| `/reset-password` | `updateUser({ password })` | Redirect to `/` on success; show error + link to `/forgot-password` on failure |

- [ ] **Step 1: Write register page (+ form)** mirroring SAT verbatim. Include the "Sign up with Google" button (same OAuth call as login).

- [ ] **Step 2: Write forgot-password page (+ form).**

- [ ] **Step 3: Write reset-password page (+ form).**

- [ ] **Step 4: Verify `pnpm type-check` exits 0 and `pnpm build` succeeds.**

---

## Task 7: Real middleware + `(app)` route group

**Files:**
- Modify: `middleware.ts` (replace no-op stub)
- Create: `app/(app)/layout.tsx`
- Move: `app/page.tsx` → `app/(app)/page.tsx`

- [ ] **Step 1: Replace `middleware.ts` with real gating**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/api/admin/generate-questions',
  '/how-it-works',
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do no work between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

- [ ] **Step 2: Move `app/page.tsx` → `app/(app)/page.tsx`**

```bash
mkdir -p app/\(app\)
git mv app/page.tsx 'app/(app)/page.tsx'
```

- [ ] **Step 3: Create `app/(app)/layout.tsx`**

```tsx
import { getOrCreateProfile } from '@/app/lib/auth/profile';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Side effect: lazily creates act.profiles row on first authenticated request.
  // Result is currently unused at the layout level (no header yet);
  // sub-project #4 will introduce <AppHeader/> here and read the profile.
  await getOrCreateProfile();
  return <>{children}</>;
}
```

- [ ] **Step 4: Verify `pnpm type-check` exits 0 and `pnpm build` succeeds.**

The build should show 5 new auth pages in the route table: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/` (now under `(app)`). The middleware should still be ~34 kB.

- [ ] **Step 5: Smoke test in dev**

Start dev server via Bash with `run_in_background: true`:
```bash
pnpm dev
```

Wait for "Ready". Then probe:
```bash
curl -s -o /dev/null -w "HTTP %{http_code} -> %{redirect_url}\n" -L --max-redirs 0 http://localhost:3000/
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/login
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/register
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/how-it-works
```

Expected:
- `/` → HTTP 307 redirect to `/login` (unauthenticated)
- `/login` → HTTP 200
- `/register` → HTTP 200
- `/how-it-works` → HTTP 200

Kill the background dev server when done.

- [ ] **Step 6: Commit everything together (tasks 2-7)**

```bash
git add app/lib/auth/ app/auth/callback/ 'app/(auth)/' 'app/(app)/' middleware.ts
# Note: app/page.tsx removal is recorded via git mv in Step 2
git commit -m "feat(auth): email+password + Google OAuth with @supabase/ssr"
```

If the file structure has multiple commits (e.g., schemas committed earlier in Task 2), that's fine — adjust the messages accordingly per task. For minimum-noise history, batch Tasks 2-7 into a single "feat(auth):" commit since they're tightly coupled.

---

## Task 8: Deploy + verify on Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Trigger production deploy**

```bash
pnpm dlx vercel --prod --yes
```

Capture the deploy URL.

- [ ] **Step 3: Smoke test the live deploy**

```bash
PROD_URL=https://act-app-ten.vercel.app
curl -s -o /dev/null -w "/ => %{http_code} %{redirect_url}\n" --max-redirs 0 $PROD_URL/
curl -s -o /dev/null -w "/login => %{http_code}\n" $PROD_URL/login
curl -s -o /dev/null -w "/register => %{http_code}\n" $PROD_URL/register
curl -s -o /dev/null -w "/forgot-password => %{http_code}\n" $PROD_URL/forgot-password
curl -s -o /dev/null -w "/reset-password => %{http_code}\n" $PROD_URL/reset-password
curl -s -o /dev/null -w "/how-it-works => %{http_code}\n" $PROD_URL/how-it-works
curl -s -o /dev/null -w "/auth/callback => %{http_code} %{redirect_url}\n" --max-redirs 0 $PROD_URL/auth/callback
```

Expected:
- `/` → 307 redirect to `/login`
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/how-it-works` → 200
- `/auth/callback` (no code) → 307 to `/login?error=auth`

- [ ] **Step 4: Tag**

```bash
git tag post-auth
git push --tags
```

---

## Task 9: Update CLAUDE.md

- [ ] **Step 1: Append Auth-specific gotchas**

Add to the existing `CLAUDE.md`:
- The `(app)/` route group convention (authenticated routes vs. `(auth)/`)
- `getOrCreateProfile()` lives in `app/lib/auth/profile.ts` and is wrapped in `cache()`
- The 5 Foundation tech-debt items are RESOLVED (remove the tracking entries)

- [ ] **Step 2: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs(auth): document (app)/ route group and clear resolved tech debt"
git push
```

---

## Done When

- [ ] `act.protect_profile_role` is `SECURITY INVOKER`; `set_updated_at`, `passages_fill_defaults`, `questions_fill_defaults` have locked `search_path` (Supabase advisor reports 0 WARN on these)
- [ ] All 4 auth pages render at 200 on production
- [ ] `/` redirects to `/login` for unauthenticated visitors on production
- [ ] `/auth/callback` exists and handles missing-code gracefully
- [ ] Real middleware is in place (no-op stub gone)
- [ ] `(app)/page.tsx` exists; `app/page.tsx` removed
- [ ] `(app)/layout.tsx` calls `getOrCreateProfile()`
- [ ] `pnpm type-check` exits 0; `pnpm build` succeeds; `pnpm dlx tsx scripts/check-format.ts` still passes
- [ ] Tag `post-auth` pushed
