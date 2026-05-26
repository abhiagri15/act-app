# ACT App — Sub-project #2 (Auth) Design

> Narrower spec built against the overview design at `2026-05-26-act-app-overview-design.md`. Sub-project #2 delivers the sign-in / sign-up / password reset flow on top of the Foundation scaffold.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-auth`

---

## 1. Scope & Goals

Deliver a working email/password + Google OAuth sign-in flow on top of Foundation. After this sub-project lands:

- An unauthenticated visitor lands on `/login` (every non-public route redirects there).
- A signed-in user can reach `/` and sees the placeholder home page.
- A first-time sign-in lazily creates an `act.profiles` row from the user's `auth.users` metadata.
- A signed-in user visiting `/login` or `/register` is redirected to `/`.
- A signed-in user can sign out via a server action and return to `/login`.

**In scope:**
- 4 auth pages under `(auth)` route group: login, register, forgot-password, reset-password
- Shared compact centered `(auth)/layout.tsx` with ACT branding
- `app/auth/callback/route.ts` — OAuth + email-link code exchange
- `app/lib/auth/schemas.ts` — zod schemas for the 4 forms
- `app/lib/auth/profile.ts` — `getOrCreateProfile()` cache-wrapped server helper
- `app/lib/auth/actions.ts` — `signOut()` server action
- Real `middleware.ts` (replaces Foundation's no-op stub): session refresh + PUBLIC_PATHS check + auth-page redirect-when-signed-in
- New `(app)/` authenticated route group with `(app)/layout.tsx` that calls `getOrCreateProfile()` on every render — the existing placeholder home page moves to `(app)/page.tsx`
- ONE pre-Auth cleanup migration (`20260526010000_act_foundation_followups.sql`) that resolves the 5 Supabase advisor warnings from Foundation:
  1. `act.protect_profile_role` → `SECURITY INVOKER` + revoke EXECUTE from PUBLIC
  2. `act.set_updated_at` → `set search_path = act, pg_temp`
  3. `act.passages_fill_defaults` → `set search_path = act, public, pg_temp`
  4. `act.questions_fill_defaults` → `set search_path = act, public, pg_temp`
  5. (Bundled into #1 above; only 1 trigger fn has SECURITY DEFINER)

**Explicitly deferred:**
- `requireAdmin()` helper — sub-project #6 (Admin)
- AppHeader / sign-out button UI — sub-project #4 (Persistence) introduces the in-app shell
- Account deletion / profile editing UI — not in scope of any current sub-project
- Email verification flow tightening — Supabase default (confirmation email on register) stands
- Non-Google OAuth providers (Apple, GitHub, etc.) — not in scope

**Out of scope for v1 entirely:**
- Password strength meter
- Captcha / rate limiting beyond Supabase defaults
- Magic-link-only flow
- Two-factor auth

### Success bar

1. New visitor lands on `https://act-app-ten.vercel.app` → redirected to `/login`.
2. New user clicks "Sign up with Google" → completes OAuth flow → lands on `/` → `act.profiles` row exists with `full_name`, `avatar_url` populated from Google.
3. New user registers via email/password → receives Supabase confirmation email → clicks link → lands on `/` → `act.profiles` row exists with `full_name` from form.
4. Returning user visits `/login` with active session → redirected to `/`.
5. Signed-in user calls `signOut()` server action → cookie cleared → redirected to `/login`.
6. Supabase advisor scan reports 0 WARN-level lints in the `act` schema.

---

## 2. Stack & Conventions

Unchanged from Foundation. Adds three runtime concerns:

- **`@supabase/ssr`** — used for both server and browser auth clients. Already installed.
- **react-hook-form + zod** — already installed; used for all 4 forms.
- **React `cache()`** — used in `getOrCreateProfile()` so the `(app)/layout` profile read and any page-level reads collapse to one DB call per request.

Mirrors SAT verbatim except for branding strings.

---

## 3. Routes & File Structure

```
app/
├── (auth)/                              new
│   ├── layout.tsx                       compact centered shell, ACT branding
│   ├── login/page.tsx                   email+pwd form + Google OAuth button
│   ├── register/page.tsx                full name + email + pwd + confirm + Google OAuth
│   ├── forgot-password/page.tsx         email-only; calls resetPasswordForEmail()
│   └── reset-password/page.tsx          new password + confirm; calls updateUser()
│
├── auth/
│   └── callback/route.ts                new — OAuth + email link code exchange
│
├── (app)/                               new — authenticated route group
│   ├── layout.tsx                       calls getOrCreateProfile() + renders children
│   └── page.tsx                         moved from app/page.tsx
│
├── how-it-works/page.tsx                unchanged; public
│
├── lib/
│   ├── auth/                            new
│   │   ├── schemas.ts                   loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema (+ inferred types)
│   │   ├── profile.ts                   getOrCreateProfile() (server-only, cache())
│   │   └── actions.ts                   signOut() server action
│   ├── supabase/                        unchanged
│   └── act/                             unchanged
│
└── middleware.ts                        rewritten (no-op stub → real gating)

supabase/migrations/
└── 20260526010000_act_foundation_followups.sql    new (5-statement cleanup)
```

---

## 4. Middleware

Real middleware replaces Foundation's no-op stub.

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

**Key invariants:**
- No work between `createServerClient(...)` and `supabase.auth.getUser()` — Supabase docs require this for correct cookie refresh.
- `PUBLIC_PATHS` check uses `startsWith(`${p}/`)` so `/auth/callback/anything` is also public.
- `/api/admin/generate-questions` is public-from-session but secret-gated by `CRON_SECRET` (sub-project #3 enforces).
- Matcher unchanged from Foundation.

---

## 5. Auth Pages

All four pages mirror SAT verbatim except branding. Form components are `'use client'` boundaries calling the browser Supabase client (`createClient` from `app/lib/supabase/client.ts`); page-level wrappers are server components.

### 5.1 `(auth)/layout.tsx`

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

### 5.2 `(auth)/login/page.tsx`

Form fields: email, password. Submit calls `signInWithPassword`. Includes a "Sign in with Google" button calling `signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`. Links: `/register`, `/forgot-password`. Errors rendered inline as a one-line alert above the submit button.

### 5.3 `(auth)/register/page.tsx`

Form fields: full name, email, password, confirm password. Submit calls `signUp({ email, password, options: { data: { full_name }, emailRedirectTo: `${origin}/auth/callback` }})`. Same Google OAuth button as login. Link back to `/login`. After successful sign-up, render a "Check your email to confirm" panel instead of redirecting (Supabase confirmation flow).

### 5.4 `(auth)/forgot-password/page.tsx`

Form fields: email. Submit calls `resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })`. Renders a "Check your email" confirmation panel after submit.

### 5.5 `(auth)/reset-password/page.tsx`

Form fields: new password, confirm password. The user arrives here after clicking the magic link → `/auth/callback?code=…&next=/reset-password`, which exchanges the code for a temporary session, then redirects here. Submit calls `updateUser({ password })`. On success, redirects to `/`. On failure (session expired), shows an error with a "Request a new reset link" link to `/forgot-password`.

### 5.6 `app/auth/callback/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  // Open-redirect defense: only allow same-origin absolute paths.
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

---

## 6. `(app)` Route Group + Profile Helper

The placeholder home page moves from `app/page.tsx` to `app/(app)/page.tsx`. A new `app/(app)/layout.tsx` wraps every authenticated page and calls `getOrCreateProfile()` so the profile row is reliably created on first authenticated request.

```tsx
// app/(app)/layout.tsx
import { getOrCreateProfile } from '@/app/lib/auth/profile';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Side effect: lazily creates act.profiles row on first authenticated request.
  // Result is currently unused at the layout level (no header yet);
  // sub-project #4 will introduce <AppHeader/> here and read the profile.
  await getOrCreateProfile();
  return <>{children}</>;
}
```

### `app/lib/auth/profile.ts`

Mirrors SAT verbatim except for schema name (`act` instead of `sat`).

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

export const getOrCreateProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

**Why a layout-level call** (and not just at each page): so when sub-project #4 introduces `<AppHeader/>` that reads the profile, both the header and the page can use the cached result from one DB call.

### `app/lib/auth/actions.ts`

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

(No UI button for this until sub-project #4; the action exists so calls can be wired in then.)

---

## 7. Zod Schemas

`app/lib/auth/schemas.ts` — verbatim from SAT:

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

---

## 8. Foundation Tech-Debt Migration

`supabase/migrations/20260526010000_act_foundation_followups.sql`:

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

Applied via Supabase MCP `apply_migration` as the FIRST step of sub-project #2. After this, running the Supabase advisor should report 0 WARN-level lints in the `act` schema.

---

## 9. Sub-project Boundaries

**What #3 (AI) gets from #2:**
- A signed-in user can hit `/` (so AI's `/api/admin/generate-questions` cron route can be exempted from session gating via PUBLIC_PATHS — already done in #2's middleware).
- `act.profiles` is reliably populated; the `draw_test` RPC (sub-project #3) can scope to `auth.uid()`.

**What #4 (Persistence) gets from #2:**
- A signed-in user lands in `(app)/` group, and the `getOrCreateProfile()` cached profile is ready for `<AppHeader/>`.
- `signOut()` server action exists; sub-project #4's header button just imports and calls it.

**What this sub-project explicitly does NOT do:**
- Create any admin guard or admin route.
- Render any AppHeader / nav.
- Set up profile-edit pages.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Supabase Site URL set to SAT's URL → OAuth redirects to SAT app | Confirm in Task 16 of Foundation that Redirect URLs allow-list includes `https://act-app-ten.vercel.app/**`; do not change Site URL (Supabase uses Redirect URL allow-list to validate the `redirectTo` passed by the app). Already verified in Foundation. |
| Concurrent first-load races between `<AppLayout/>` and a page component both calling `getOrCreateProfile()` simultaneously | `react.cache()` collapses calls within a single request. Across-request races handled by the insert-then-reselect pattern. |
| Foundation tech-debt migration accidentally breaks an existing trigger | The migration only uses `alter function`. Triggers attach to functions by OID — function bodies and signatures are unchanged. SAT's exact same migration shipped without incident. |
| Email confirmation flow blocks user → register but never lands on `/` (no header to show "check email") | Register page renders a "Check your email" panel on successful `signUp()`; user clicks email link → `/auth/callback?next=/` → into the app. |
| Google OAuth missing for a fresh Supabase project | Supabase project is shared with SAT, where Google OAuth is already configured. No-op. |

---

## 11. Open Questions Resolved

| Question | Decision |
|----------|----------|
| How closely should ACT Auth mirror SAT | Verbatim mirror, only branding diverges |
| Tech-debt fix-up location | Bundled as Auth's first migration |
| `requireAdmin()` helper | Deferred to sub-project #6 |
| Email verification strictness | Supabase default (confirmation required) |
| Extra OAuth providers | None for v1 |

---

## 12. References

- Foundation overview spec: `2026-05-26-act-app-overview-design.md`
- SAT auth implementation as precedent:
  - `Personal/satpracticereact/sat-app/app/(auth)/`
  - `Personal/satpracticereact/sat-app/app/auth/callback/route.ts`
  - `Personal/satpracticereact/sat-app/app/lib/auth/{profile,actions,schemas}.ts`
  - `Personal/satpracticereact/sat-app/middleware.ts`
- Supabase URL Configuration: PropLedger dashboard (verified in Foundation Task 16)
