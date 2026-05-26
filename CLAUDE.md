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

Foundation scaffold only as of this commit. See [`docs/superpowers/specs/2026-05-26-act-app-overview-design.md`](docs/superpowers/specs/2026-05-26-act-app-overview-design.md) for the overall architecture and the 7 sub-project plan.

Tag chain: `post-foundation` → (Auth) → (AI) → (Persistence) → (Analytics) → (Admin) → (Feedback).

- Production deploy: https://act-app-ten.vercel.app
- GitHub repo: https://github.com/abhiagri15/act-app
- Supabase project: shared with sat-app (PropLedger, ref `falgykkspbtrwdcchayi`) under the `act` schema

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

- **Trigger functions have mutable `search_path`** (tech debt, INFO advisory). The three trigger functions `act.set_updated_at`, `act.passages_fill_defaults`, `act.questions_fill_defaults` do not set `search_path = act, public, pg_temp`. SAT app has the same advisory. Fix in sub-project #2's first migration when SECURITY DEFINER RPCs are added.

## Foundation followups (deferred to sub-project #2 or earlier)

- **Preview env vars not set on Vercel.** Vercel CLI 54.4.1 rejected `vercel env add ... preview --yes` due to a `git_branch_required` prompt that wouldn't dismiss. Production + Development env vars are set; Preview needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` set via the dashboard or `--value` CLI form.

- **GitHub auto-deploy connection failed during `vercel link`.** The Vercel project is not currently wired to push-to-deploy from the GitHub repo. Connect via Vercel dashboard → Settings → Git → "Connect Git Repository". Until then, deploys are manual (`pnpm dlx vercel --prod`).
