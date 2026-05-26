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

Foundation + Auth + AI + Persistence shipped as of `post-persistence`. See [`docs/superpowers/specs/2026-05-26-act-app-overview-design.md`](docs/superpowers/specs/2026-05-26-act-app-overview-design.md) for the overall architecture and the 7 sub-project plan; auth specifics in [`docs/superpowers/specs/2026-05-26-act-app-auth-design.md`](docs/superpowers/specs/2026-05-26-act-app-auth-design.md); persistence specifics in [`docs/superpowers/specs/2026-05-26-act-app-persistence-design.md`](docs/superpowers/specs/2026-05-26-act-app-persistence-design.md).

Tag chain: `post-foundation` → `post-auth` → `post-persistence` → (Analytics) → (Admin) → (Feedback). *(AI sub-project is between Auth and Persistence in scope but no separate tag; the AI commits sit on `main` before persistence.)*

- Production deploy: https://act-app-ten.vercel.app
- GitHub repo: https://github.com/abhiagri15/act-app
- Supabase project: shared with sat-app (PropLedger, ref `falgykkspbtrwdcchayi`) under the `act` schema

### Route groups

- **`app/(auth)/`** — public auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`). Compact centered layout with ACT branding. Reachable while signed out; the middleware redirects signed-in users away from `/login` and `/register` to `/`.
- **`app/(app)/`** — authenticated route group. `(app)/layout.tsx` calls `getOrCreateProfile()` (cached) AND renders `<AppHeader/>` above each page. Sub-trees:
  - `(app)/page.tsx` — dashboard. Renders "Start a Full Test" CTA + attempt history via `listMyAttempts()`. In-progress attempts link back to `/test/[id]` (resume); submitted attempts link to `/dashboard/attempts/[id]` (review).
  - `(app)/test/new/` — pre-test screen with the Science toggle + confirm modal. Calls `supabase.rpc('draw_test')` from the browser client, then routes to `/test/[id]/english`.
  - `(app)/test/[attemptId]/` — runner sub-tree. `layout.tsx` guards "attempt must be live" (404 / redirect on submitted/abandoned). Each section page (`english`, `math`, `break`, `reading`, `science`, `results`) calls `guardSectionRoute()` from `route-guards.ts` to enforce URL-segment-matches-current-section + force-lock-on-deadline.
  - `(app)/dashboard/attempts/[id]/` — submitted-attempt review. Lists every question grouped by section + passage, with the user's selection marked + correct answer + explanation.
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

## Persistence sub-project (sub-project #4) gotchas

- **`act.get_my_attempt` gates `answer_key` + `explanation` on `status`.** When `status='in_progress'`, both columns are STRIPPED from each question in the returned jsonb — the test runner never sees them. When `status='submitted'`, they are included for the review page. The gate is at the SQL layer (the function branches on the attempt's status), not in app code; a client that tries to "peek" at the answer mid-test gets nothing back. Do not move this gate to TypeScript — keep it in the RPC.

- **`act.draw_test` pre-populates blank `attempt_responses` rows for every drawn question.** This is the persistence anchor — `act.get_my_attempt` joins back through `attempt_responses` to materialize the full question + passage payload on both resume and review. Without the blank rows, a brand-new attempt would have nothing to read until the user answered something. If you change `draw_test`, keep the "insert blanks" CTE intact, or `get_my_attempt` will return an empty questions array on first mount.

- **`useTestSession` fires `upsertResponse` fire-and-forget on every answer/flag change (debounced 200ms).** Do NOT block the UI on this — the local response state is the optimistic source of truth. If the upsert fails (e.g. network blip), the warning is logged but not surfaced; the `submit_section` payload re-upserts everything as the airtight backstop. Per-question debounce timers are stored in a `useRef<Map>` and cleared on unmount. If you change the debounce semantics, keep the cleanup or the React tree will leak timers.

- **Section runner state lives entirely in `useTestSession`.** The timer is a single `setInterval` driven by `endsAt` (the server clock — the client never decides when a section ends). At `remainingSec === 0`, the hook calls `submitNow()` once (guarded by `autoSubmittedRef`). If `submit_section` raises "section deadline missed; call force_lock_section", the hook falls back to `forceLockSection`. Do not "simplify" the auto-submit guard — without it, the 0→0 tick chain would retry every second.

- **`act.test_attempts` + `act.attempt_responses` are RLS select-only — every write goes through a security-definer RPC.** The 5 writes are `start_section`, `submit_section`, `force_lock_section`, `finalize_attempt`, `upsert_response` (plus `draw_test` from the AI sub-project). Each one sets `user_id := auth.uid()` itself and validates ownership at the function layer. If you add a write path, go through a security-definer function — do not add an `insert` / `update` policy.

- **The section-page guard chain is split across `layout.tsx` + `route-guards.ts`.** The layout is allowed to enforce "attempt exists / is in progress" but can't see the URL segment. Each section page calls `guardSectionRoute(attemptId, '<section>')` which: (1) validates URL matches `current_section`, (2) redirects to `current_section` if not, (3) force-locks + advances if the deadline has passed (>10s grace). The page then calls `startSection` (idempotent) and re-fetches the snapshot for the fresh `ends_at`. Keep both halves; the layout-only "is in progress" check isn't enough — without `guardSectionRoute`, a user could navigate directly to `/test/[id]/reading` while still on English and bypass the section sequence.

- **`act.draw_test` raises a friendly exception on "pool too thin".** The warm-pool (sub-project #3's `scripts/warm-pool.ts`) must complete enough rounds to satisfy the per-test requirements (>=5 English passages, >=4 Reading, >=45 Math standalone questions, >=7 Science). If it raises during pre-test, the `NewTestForm` surfaces the error message verbatim — this is the cold-start UX. Do not catch and swallow the error; the user needs to know to wait or contact an admin.

- **Two-pane split ratio persists in localStorage keyed `act-split-{section}`.** Reading/Science use `TwoPaneRunner`, English uses `EnglishRunner` (with inline markers). Both share the same split-ratio shape: a number 30–70 representing left-pane percent. Below 768px viewport, both collapse to stacked layout (sticky toggle on Reading/Science, max-40%-passage-on-top for English). Keep the storage key per-section so a user can have different preferred ratios per layout.

- **`StimulusRenderer` is dependency-free.** It renders `passages.stimuli` jsonb arrays of `{kind: 'table' | 'figure', caption, data}` using HTML tables and inline SVG (with linear-interp scaling, axes, point markers, multi-series legend). A try/catch wraps each item so one malformed stimulus dumps as raw JSON in a red box while the other stimuli on the same passage still render. Do NOT add a charting library — the SVG is intentional (small bundle, no client-only deps).

## Foundation followups (deferred to sub-project #2 or earlier)

- **Preview env vars not set on Vercel.** Vercel CLI 54.4.1 rejected `vercel env add ... preview --yes` due to a `git_branch_required` prompt that wouldn't dismiss. Production + Development env vars are set; Preview needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` set via the dashboard or `--value` CLI form.

- **GitHub auto-deploy connection failed during `vercel link`.** The Vercel project is not currently wired to push-to-deploy from the GitHub repo. Connect via Vercel dashboard → Settings → Git → "Connect Git Repository". Until then, deploys are manual (`pnpm dlx vercel --prod`).

- **`.env.local` is not present locally.** All env vars live in Vercel (Production + Development). `pnpm dev` cannot exercise middleware without them. If a dev-loop workflow becomes needed, pull from Vercel: `pnpm dlx vercel env pull .env.local`.
