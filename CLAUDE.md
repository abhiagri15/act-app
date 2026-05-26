# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Commands

```bash
pnpm install
pnpm dev               # http://localhost:3000
pnpm build
pnpm type-check
pnpm lint
pnpm dlx tsx scripts/check-format.ts
```

## Architecture

Foundation + Auth shipped as of `post-auth`. See [`docs/superpowers/specs/2026-05-26-act-app-overview-design.md`](docs/superpowers/specs/2026-05-26-act-app-overview-design.md) for the overall architecture and the 7 sub-project plan; auth specifics in [`docs/superpowers/specs/2026-05-26-act-app-auth-design.md`](docs/superpowers/specs/2026-05-26-act-app-auth-design.md).

Tag chain: `post-foundation` → `post-auth` → (AI) → (Persistence) → (Analytics) → (Admin) → (Feedback).

- Production deploy: https://act-app-ten.vercel.app
- GitHub repo: https://github.com/abhiagri15/act-app
- Supabase project: shared with sat-app (PropLedger, ref `falgykkspbtrwdcchayi`) under the `act` schema

### Route groups

- **`app/(auth)/`** — public auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`). Compact centered layout with ACT branding. Reachable while signed out; the middleware redirects signed-in users away from `/login` and `/register` to `/`.
- **`app/(app)/`** — authenticated route group. `(app)/layout.tsx` calls `getOrCreateProfile()` on every render (the side effect is the point — sub-project #4 will introduce `<AppHeader/>` here and read the cached profile). The placeholder home page lives at `app/(app)/page.tsx` (moved from `app/page.tsx` in Auth).
- **`app/auth/callback/route.ts`** — OAuth + email-link `code` exchange, then redirects into the app. Same-origin redirect guard on the `next` param.
- **`app/how-it-works/`** — public marketing page, outside both groups.

### Profile helper

`getOrCreateProfile()` lives in [`app/lib/auth/profile.ts`](app/lib/auth/profile.ts), wrapped in React `cache()` so the layout's read and any page-level reads collapse to one DB call per request. Reads/writes `act.profiles` via `supabase.schema('act')`. Insert-then-reselect handles the concurrent first-load race. The `act` schema must be exposed in Supabase API settings (already done in Foundation Task 16).

## Auth gotchas

- **The `act` schema MUST be exposed in Supabase API settings.** The app will query `act.profiles` via `supabase.schema('act').from('profiles')` (added in sub-project #2). Without exposure, every authenticated page errors. One-time dashboard action on the Property Ledger project. Foundation already added it; verify before deploying sub-project #2.

- **`act.profiles.role` is not user-writable.** Enforced by the `protect_profile_role` BEFORE INSERT/UPDATE trigger plus column-scoped GRANTs. To promote: `update act.profiles set role='admin' where id='<uuid>'` as `service_role`.

## Things that will bite you

- **`app/lib/supabase/admin.ts` is SERVER-ONLY.** Importing it from a `'use client'` module bundles `SUPABASE_SERVICE_ROLE_KEY` into the browser. Verification command:
  ```powershell
  Get-ChildItem -Path app -Recurse -Include *.tsx,*.ts | Select-String -Pattern "supabase/admin|SUPABASE_SERVICE_ROLE_KEY"
  ```
  Expected: matches only in `app/lib/supabase/admin.ts` (and `app/lib/ai/*.ts` once sub-project #3 lands).

- **Migrations apply to the live PropLedger DB.** There is no local Supabase. Use the Supabase MCP `apply_migration` tool. The migrations in `supabase/migrations/` are committed only for reproducibility.

- **Orphan `next dev` processes survive Ctrl+C.** If the next `pnpm dev` lands on port 3001 instead of 3000, kill stray node processes:
  ```powershell
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*act-app*" } | Stop-Process -Force -Confirm:$false
  ```

- **Vercel Next.js security gate.** `next` is pinned to `15.5.18` (CVE-patched). Do not downgrade; Vercel will hard-fail the deploy on any earlier 15.x with a known CVE.

- **`suppressHydrationWarning` is on `<body>` only** in `app/layout.tsx` — defense against browser extension DOM injection. Do not extend it to other elements (would hide real hydration mismatches).

## Foundation followups (deferred to sub-project #2 or earlier)

- **Preview env vars not set on Vercel.** Vercel CLI 54.4.1 rejected `vercel env add ... preview --yes` due to a `git_branch_required` prompt that wouldn't dismiss. Production + Development env vars are set; Preview needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` set via the dashboard or `--value` CLI form.

- **GitHub auto-deploy connection failed during `vercel link`.** The Vercel project is not currently wired to push-to-deploy from the GitHub repo. Connect via Vercel dashboard → Settings → Git → "Connect Git Repository". Until then, deploys are manual (`pnpm dlx vercel --prod`).

- **`.env.local` is not present locally.** All env vars live in Vercel (Production + Development). `pnpm dev` cannot exercise middleware without them. If a dev-loop workflow becomes needed, pull from Vercel: `pnpm dlx vercel env pull .env.local`.
