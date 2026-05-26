# ACT App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `act-app` Next.js 15 project with TypeScript strict mode, Tailwind + shadcn/ui, Supabase clients (`@supabase/ssr`), TanStack Query, the `act` Postgres schema with all 8 tables + RLS + triggers + seeded score scales, placeholder home + how-it-works pages, and a deployed Vercel project. Tag the result `post-foundation`.

**Architecture:** Mirror `Personal/satpracticereact/sat-app/`'s Foundation. New folder `Personal/actpracticereact/act-app/`. New GitHub repo. New Vercel project. **Same** Supabase project as SAT (PropLedger, ref `falgykkspbtrwdcchayi`) but a fresh `act` schema isolated from `sat`. Auth, AI generation, persistence, analytics, admin, and feedback are deferred to sub-projects #2–#7.

**Tech Stack:** Next.js 15.5.18, React 19, TypeScript 6 strict, pnpm 9, Tailwind 3, shadcn/ui, `@supabase/ssr` 0.10, `@supabase/supabase-js` 2.106, TanStack Query 5.100, react-hook-form 7, zod 4. Supabase MCP for migrations against the live PropLedger project.

**Spec:** [`docs/superpowers/specs/2026-05-26-act-app-overview-design.md`](../specs/2026-05-26-act-app-overview-design.md)

**Reference codebase:** [`Personal/satpracticereact/sat-app/`](../../../../satpracticereact/sat-app/) — copy patterns verbatim except where the spec explicitly diverges (passage model, section state machine, score scales). When a step says "mirror SAT", open the corresponding SAT file and use its content as the template.

**Working directory for ALL commands below:** `c:\Users\AbishekPotlapalli\Desktop\Projects\Personal\actpracticereact\act-app`

**Shell conventions:**

- ` ```bash ` blocks run via the Bash tool. POSIX syntax (`&&`, `\` line continuations, forward-slash paths) works because the Bash tool runs through a POSIX-compatible shell on this Windows host. Prefer Bash blocks for git, pnpm, curl, gh.
- ` ```powershell ` blocks run via the PowerShell tool. Use these explicitly for `Get-Process`, `Stop-Process`, `Test-Path`, registry access, or anything that needs Windows-native semantics.
- For background processes (e.g. `pnpm dev`), use the Bash tool's `run_in_background: true` option instead of "in another terminal" instructions — agents have one shell at a time per tool invocation.

---

## Chunk 0: Preflight

### Task 0: Preflight checks (idempotency guard)

Before touching any state, verify the world is in the expected starting position. If anything is off, **stop and ask the user** — re-running Foundation over a partially-completed Foundation can corrupt state.

- [ ] **Step 1: Verify act-app directory only contains the docs spec**

```bash
ls -la c:/Users/AbishekPotlapalli/Desktop/Projects/Personal/actpracticereact/act-app
```

Expected: only `docs/` (containing the overview spec). If `package.json`, `app/`, or `.git/` already exist, Foundation has been partially or fully run before — surface to the user before continuing.

- [ ] **Step 2: Verify `act` schema does not yet exist on PropLedger**

Use Supabase MCP tool `list_tables` with `project_id: 'falgykkspbtrwdcchayi'` and `schemas: ['act']`.

Expected: empty array (schema does not exist, or exists with no tables). If tables exist, do NOT proceed — running the schema migration over existing tables will fail on `create table if not exists` and leave the migration history inconsistent. Surface to the user.

- [ ] **Step 3: Verify GitHub repo does not yet exist**

```bash
gh repo view abhiagri15/act-app 2>&1 | head -3
```

Expected: error message containing "Could not resolve" or "not found". If the repo exists, Foundation has already been deployed — surface to the user.

- [ ] **Step 4: Confirm with user**

Ask the user: "All three preflight checks pass — no existing act-app code, no `act` schema in Supabase, no `abhiagri15/act-app` GitHub repo. OK to proceed with Foundation?" Wait for explicit approval before Task 1.

---

## Chunk 1: Repo & Next.js Scaffold

### Task 1: Initialize git repo + .gitignore + README

**Files:**
- Create: `act-app/.gitignore`
- Create: `act-app/README.md`

- [ ] **Step 1: Initialize git**

```bash
cd c:/Users/AbishekPotlapalli/Desktop/Projects/Personal/actpracticereact/act-app
git init -b main
```

Expected: `Initialized empty Git repository...`

- [ ] **Step 2: Write `.gitignore`**

First try to read `Personal/satpracticereact/sat-app/.gitignore` and copy its contents verbatim to `act-app/.gitignore`. If that file does not exist or is empty, fall back to this minimum content:

```
node_modules/
.next/
.env*.local
.env
*.log
.DS_Store
.vercel
tsconfig.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Write minimal `README.md`**

```markdown
# act-app

Enhanced ACT (2025+) practice platform. Companion to `sat-app`.

See `docs/superpowers/specs/2026-05-26-act-app-overview-design.md` for the architecture.

## Commands

```bash
pnpm install
pnpm dev           # http://localhost:3000
pnpm build
pnpm type-check
```
```

- [ ] **Step 4: Verify .gitignore catches secrets**

Run: `git check-ignore .env.local`
Expected output: `.env.local`

If it doesn't print, the .gitignore is wrong — fix it before any commit.

- [ ] **Step 5: First commit**

```bash
git add .gitignore README.md docs/
git commit -m "chore: initialize repo with overview spec"
```

Expected: A commit referencing only `.gitignore`, `README.md`, and the docs/ tree (which already contains the spec).

---

### Task 2: Scaffold Next.js 15 + TypeScript strict

**Files:**
- Create: `act-app/package.json`
- Create: `act-app/tsconfig.json`
- Create: `act-app/next.config.ts`
- Create: `act-app/next-env.d.ts`
- Create: `act-app/app/layout.tsx`
- Create: `act-app/app/page.tsx`
- Create: `act-app/app/globals.css`

- [ ] **Step 1: Write `package.json` mirroring SAT exactly**

```json
{
  "name": "act-app",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.1",
    "@tanstack/react-query": "^5.100.11",
    "@tanstack/react-query-devtools": "^5.100.11",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.16.0",
    "next": "15.5.18",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.76.0",
    "tailwind-merge": "^3.6.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^25.9.1",
    "@types/react": "^19.2.15",
    "@types/react-dom": "^19.2.3",
    "autoprefixer": "^10.5.0",
    "eslint": "^8.57.1",
    "eslint-config-next": "^15.5.18",
    "postcss": "^8.5.15",
    "tailwindcss": "^3",
    "typescript": "^6.0.3"
  }
}
```

**Note on `next` version:** 15.5.18 is the SAT app's pinned, CVE-patched release. Do NOT downgrade. Vercel's security gate will fail the deploy on any earlier 15.x.

- [ ] **Step 2: Write `tsconfig.json` (strict)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write minimal `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ACT Practice',
  description: 'Enhanced ACT practice platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
```

Why `suppressHydrationWarning` on `<body>`: browser extensions (Grammarly, Dark Reader, password managers) inject `data-*` attributes into `<body>` after SSR but before React hydrates. SAT app's CLAUDE.md documents this gotcha and uses the same workaround. Do not extend the attribute to other elements — real hydration mismatches elsewhere should still surface.

- [ ] **Step 5: Write placeholder `app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">ACT Practice</h1>
        <p className="text-muted-foreground mt-2">Foundation scaffold. More coming.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 7: Write `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: `Done in <time>` with no errors. A `pnpm-lock.yaml` appears in the root.

- [ ] **Step 9: Verify type-check passes**

Run: `pnpm type-check`
Expected: exits 0 with no output. If errors appear, fix them now before proceeding (typically a typo or missing dep).

- [ ] **Step 10: Verify dev server boots**

Use the Bash tool with `run_in_background: true`:

```bash
pnpm dev
```

Wait until the background process logs `Ready in <ms>` (Monitor the background output, or poll with a short sleep + curl in a loop). Then in the foreground:

```bash
curl -s http://localhost:3000 | head -50
```

Expected: HTML containing the text "ACT Practice".

Stop the background `pnpm dev` job via the harness's KillShell. **Important:** SAT's CLAUDE.md documents an orphan-process gotcha — stopping `pnpm dev` kills the pnpm wrapper but the `next` child can survive on port 3000. If a later step fails with "port 3000 in use", kill stray node processes:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*act-app*" } | Stop-Process -Force -Confirm:$false
```

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts next-env.d.ts app/
git commit -m "feat(foundation): scaffold Next.js 15 + React 19 + TS strict"
```

---

### Task 3: Tailwind + shadcn/ui config

**Files:**
- Create: `act-app/tailwind.config.ts`
- Create: `act-app/postcss.config.mjs`
- Create: `act-app/components.json`

- [ ] **Step 1: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

- [ ] **Step 2: Write `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Write `components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/app/components",
    "utils": "@/app/lib/utils"
  }
}
```

- [ ] **Step 4: Create `app/lib/utils.ts` (the cn helper shadcn expects)**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Add Button (smoke test for shadcn pipeline)**

Run: `pnpm dlx shadcn@latest add button`

Expected: creates `app/components/ui/button.tsx`. If it prompts for config, accept the defaults derived from `components.json`.

If `pnpm dlx shadcn@latest` fails or hangs (Windows path issue), manually create `app/components/ui/button.tsx` by copying from `Personal/satpracticereact/sat-app/app/components/ui/button.tsx`.

- [ ] **Step 6: Verify build still passes**

Run: `pnpm type-check && pnpm build`
Expected: clean output; build produces a `.next/` folder. No "Cannot find module" errors.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts postcss.config.mjs components.json app/lib/utils.ts app/components/
git commit -m "feat(foundation): add Tailwind + shadcn/ui (button)"
```

---

### Task 4: Supabase clients + middleware stub

**Files:**
- Create: `act-app/app/lib/supabase/server.ts`
- Create: `act-app/app/lib/supabase/client.ts`
- Create: `act-app/app/lib/supabase/admin.ts`
- Create: `act-app/middleware.ts`
- Create: `act-app/.env.example`

- [ ] **Step 1: Write `app/lib/supabase/server.ts`**

Mirror SAT's. Copy from `Personal/satpracticereact/sat-app/app/lib/supabase/server.ts` exactly — the SSR client logic does not vary between apps.

- [ ] **Step 2: Write `app/lib/supabase/client.ts`**

Mirror SAT's:

```ts
import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client. Use in 'use client' components only.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write `app/lib/supabase/admin.ts` (SERVER-ONLY service-role client)**

```ts
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

// SERVER ONLY. Bypasses RLS. Never import from a 'use client' module —
// Next.js would bundle the service-role key into the browser.
// Used by AI generation (sub-project #3), admin writes (#6), and seed scripts.
export function createAdminClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

**Important:** This file is server-only. SAT app's CLAUDE.md documents the leak risk: importing this into a `'use client'` module bundles `SUPABASE_SERVICE_ROLE_KEY` into the browser. There is no static enforcement in the Foundation step — it becomes a verification command later. Add the comment at the top of the file as written.

- [ ] **Step 4: Write `middleware.ts` (stub — full auth gating lands in sub-project #2)**

```ts
import { type NextRequest, NextResponse } from 'next/server';

// Auth gating lands in sub-project #2. For Foundation, this middleware is a no-op
// pass-through so the matcher is wired up and ready.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

Sub-project #2 (Auth) will replace this body with the SAT-pattern session-refresh + PUBLIC_PATHS check. Foundation only ensures the matcher config is in place.

- [ ] **Step 5: Write `.env.example`**

```bash
# Supabase (PropLedger project, shared with sat-app — uses the `act` schema)
NEXT_PUBLIC_SUPABASE_URL=https://falgykkspbtrwdcchayi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set in Vercel>
SUPABASE_SERVICE_ROLE_KEY=<set in Vercel — server-only>

# AI generation (sub-project #3)
ACT_AI_PROVIDER=ollama-cloud
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=<set in Vercel>
OLLAMA_MODEL=deepseek-v3.1:671b-cloud

# Vercel cron security gate (sub-project #3)
CRON_SECRET=<random 32-byte hex>
```

`.env.example` is committed; `.env.local` is gitignored. The actual values are set per-environment in Vercel.

- [ ] **Step 6: Verify type-check passes with new modules**

Run: `pnpm type-check`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add app/lib/supabase/ middleware.ts .env.example
git commit -m "feat(foundation): Supabase clients (server, browser, admin) + middleware stub"
```

---

## Chunk 2: App Skeleton & Constants

### Task 5: ACT format constants

**Files:**
- Create: `act-app/app/lib/act/format.ts`

- [ ] **Step 1: Write `app/lib/act/format.ts`**

This is the single source of truth for ACT structural facts that the AI generator (#3), test runner (#4), and analytics (#5) all key off. Centralizing them here prevents drift.

```ts
// ACT structural facts. Source of truth — referenced by the AI generator,
// the test runner, the n8n workflow, and analytics. Keep in sync with
// the spec at docs/superpowers/specs/2026-05-26-act-app-overview-design.md.

export type ActSection = 'english' | 'math' | 'reading' | 'science';

export const SECTION_ORDER: readonly ActSection[] = [
  'english',
  'math',
  'reading',
  'science',
] as const;

// Enhanced ACT (2025+).
export const SECTION_QUESTION_COUNTS: Record<ActSection, number> = {
  english: 50,
  math: 45,
  reading: 36,
  science: 40,
};

// In seconds.
export const SECTION_DURATIONS_SEC: Record<ActSection, number> = {
  english: 35 * 60,
  math: 50 * 60,
  reading: 40 * 60,
  science: 40 * 60,
};

export const BREAK_DURATION_SEC = 10 * 60;

export type PassageType =
  | 'english_essay'
  | 'literary_narrative'
  | 'social_science'
  | 'humanities'
  | 'natural_science'
  | 'data_representation'
  | 'research_summaries'
  | 'conflicting_viewpoints';

// Per-passage-type fixed question count. Enforced by both act.draw_test and
// the n8n Parse Q Candidates gate. See spec §3.2.
export const PASSAGE_QUESTION_COUNTS: Record<PassageType, number> = {
  english_essay: 10,
  literary_narrative: 9,
  social_science: 9,
  humanities: 9,
  natural_science: 9,
  data_representation: 5,
  research_summaries: 6,
  conflicting_viewpoints: 7,
};

// Real Enhanced ACT Science distribution: 40 questions across 7 passages.
export const SCIENCE_PASSAGE_MIX: Array<{ type: PassageType; count: number }> = [
  { type: 'data_representation', count: 3 },   // 3 × 5 = 15
  { type: 'research_summaries', count: 3 },    // 3 × 6 = 18
  { type: 'conflicting_viewpoints', count: 1 },// 1 × 7 = 7
];                                              // total: 40

export const READING_PASSAGE_TYPES: PassageType[] = [
  'literary_narrative',
  'social_science',
  'humanities',
  'natural_science',
];

// Per-section skill taxonomy. See spec §3.4.
export const SKILLS: Record<ActSection, readonly string[]> = {
  english: [
    'production_of_writing',
    'knowledge_of_language',
    'conventions_of_standard_english',
  ],
  math: [
    'preparing_for_higher_math',
    'integrating_essential_skills',
    'modeling',
  ],
  reading: [
    'key_ideas_and_details',
    'craft_and_structure',
    'integration_of_knowledge',
  ],
  science: [
    'interpretation_of_data',
    'scientific_investigation',
    'evaluation_of_models',
  ],
};
```

- [ ] **Step 2: Add a smoke-test script for invariants**

Create `act-app/scripts/check-format.ts`:

```ts
// Verifies ACT format invariants. Run with:
//   pnpm dlx tsx scripts/check-format.ts
// Mirrors SAT's scripts/check-*.ts convention.

import {
  PASSAGE_QUESTION_COUNTS,
  READING_PASSAGE_TYPES,
  SCIENCE_PASSAGE_MIX,
  SECTION_QUESTION_COUNTS,
} from '../app/lib/act/format';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK:   ${msg}`);
}

// English: 5 passages × 10 q = 50
assert(
  PASSAGE_QUESTION_COUNTS.english_essay * 5 === SECTION_QUESTION_COUNTS.english,
  'English: 5 × english_essay (10) = 50',
);

// Reading: 4 passages × 9 q = 36
const readingTotal = READING_PASSAGE_TYPES.reduce(
  (sum, t) => sum + PASSAGE_QUESTION_COUNTS[t],
  0,
);
assert(
  readingTotal === SECTION_QUESTION_COUNTS.reading,
  `Reading: sum of 4 reading passage_types = ${SECTION_QUESTION_COUNTS.reading} (got ${readingTotal})`,
);

// Science: per-mix counts produce 40
const scienceTotal = SCIENCE_PASSAGE_MIX.reduce(
  (sum, { type, count }) => sum + PASSAGE_QUESTION_COUNTS[type] * count,
  0,
);
assert(
  scienceTotal === SECTION_QUESTION_COUNTS.science,
  `Science: SCIENCE_PASSAGE_MIX yields 40 (got ${scienceTotal})`,
);

console.log('\nAll format invariants OK.');
```

- [ ] **Step 3: Run the script**

Run: `pnpm dlx tsx scripts/check-format.ts`

Expected output:
```
OK:   English: 5 × english_essay (10) = 50
OK:   Reading: sum of 4 reading passage_types = 36 (got 36)
OK:   Science: SCIENCE_PASSAGE_MIX yields 40 (got 40)

All format invariants OK.
```

If any assertion fails, the constants disagree with the spec — fix the constants. **This is the load-bearing invariant**; later sub-projects depend on it.

- [ ] **Step 4: Commit**

```bash
git add app/lib/act/format.ts scripts/check-format.ts
git commit -m "feat(foundation): ACT format constants + invariant check"
```

---

### Task 6: TanStack Query provider + how-it-works page

**Files:**
- Create: `act-app/app/providers.tsx`
- Modify: `act-app/app/layout.tsx`
- Create: `act-app/app/how-it-works/page.tsx`

- [ ] **Step 1: Write `app/providers.tsx`**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wire into `app/layout.tsx`**

Replace the existing `app/layout.tsx` body with:

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ACT Practice',
  description: 'Enhanced ACT practice platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write `app/how-it-works/page.tsx`**

```tsx
import {
  SECTION_QUESTION_COUNTS,
  SECTION_DURATIONS_SEC,
  BREAK_DURATION_SEC,
} from '@/app/lib/act/format';

export default function HowItWorksPage() {
  const fmt = (sec: number) => `${Math.round(sec / 60)} min`;
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <h1 className="text-3xl font-semibold">How it works</h1>
      <p className="text-muted-foreground">
        This app simulates the Enhanced ACT (2025+). Each test is a fixed
        sequence of four sections with strict, section-locked timers.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Section</th>
            <th className="text-left py-2">Questions</th>
            <th className="text-left py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">English</td>
            <td>{SECTION_QUESTION_COUNTS.english}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.english)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Math</td>
            <td>{SECTION_QUESTION_COUNTS.math}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.math)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 italic text-muted-foreground">Break</td>
            <td>—</td>
            <td>{fmt(BREAK_DURATION_SEC)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Reading</td>
            <td>{SECTION_QUESTION_COUNTS.reading}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.reading)}</td>
          </tr>
          <tr>
            <td className="py-2">Science (optional)</td>
            <td>{SECTION_QUESTION_COUNTS.science}</td>
            <td>{fmt(SECTION_DURATIONS_SEC.science)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        Composite score 1–36, average of included section scaled scores.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Verify build passes**

Run: `pnpm type-check && pnpm build`
Expected: clean, no errors.

- [ ] **Step 5: Verify pages render in dev**

Start the dev server via the Bash tool with `run_in_background: true`:

```bash
pnpm dev
```

Wait for `Ready in <ms>`. Then:

```bash
curl -s http://localhost:3000/ | grep -i "ACT Practice"
curl -s http://localhost:3000/how-it-works | grep -i "Composite score"
```

Both grep commands must print a matching line. Stop the background process when done. If port-3000 stays held, run the PowerShell kill from Task 2 Step 10.

- [ ] **Step 6: Commit**

```bash
git add app/providers.tsx app/layout.tsx app/how-it-works/
git commit -m "feat(foundation): TanStack Query provider + how-it-works page"
```

---

## Chunk 3: Supabase Migrations (act Schema)

**Important context for this chunk:** Migrations apply to the **live** PropLedger Supabase project (ref `falgykkspbtrwdcchayi`) — the same project SAT uses. Use the Supabase MCP tool `mcp__claude_ai_Supabase__apply_migration` for each migration. **There is no local Supabase running.** Confirm `act` is not an existing schema before starting (it shouldn't be):

```
mcp__claude_ai_Supabase__list_tables({ project_id: 'falgykkspbtrwdcchayi', schemas: ['act'] })
```

Expected: empty / no tables. If `act` already has tables, STOP and ask the user before proceeding — you may be re-applying an aborted Foundation.

All migration filenames use the timestamp prefix `20260526NNNNNN_` (where NNNNNN is sequential six-digit padding starting `000000`). All migration files are also committed to `supabase/migrations/` for reproducibility.

### Task 7: Create `act` schema

**Files:**
- Create: `act-app/supabase/migrations/20260526000000_act_schema.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Foundation sub-project — creates the `act` schema with deny-by-default RLS.
-- Tables defined in subsequent migrations:
--   act.profiles, act.passages, act.questions,
--   act.test_attempts, act.attempt_responses,
--   act.score_scales, act.question_flags, act.generation_runs.

create schema if not exists act;

-- Deny-by-default for Supabase roles AND the implicit PUBLIC role,
-- so future SECURITY DEFINER functions don't inherit EXECUTE accidentally.
revoke all on schema act from anon, authenticated, public;
grant usage on schema act to anon, authenticated;

alter default privileges in schema act
  revoke all on tables from anon, authenticated, public;
alter default privileges in schema act
  revoke all on sequences from anon, authenticated, public;
alter default privileges in schema act
  revoke all on functions from anon, authenticated, public;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use tool `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: `falgykkspbtrwdcchayi`
- `name`: `act_schema`
- `query`: (the SQL from Step 1)

Expected: returns success object.

- [ ] **Step 3: Verify schema exists**

Use tool `mcp__claude_ai_Supabase__list_tables` with `schemas: ['act']`.

Expected: empty array (schema exists, no tables yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526000000_act_schema.sql
git commit -m "feat(foundation): create act schema with deny-by-default"
```

---

### Task 8: act.profiles table

**Files:**
- Create: `act-app/supabase/migrations/20260526000100_act_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Foundation — act.profiles.
-- Mirrors sat.profiles structure exactly (id, email, full_name, avatar_url,
-- role, created_at, updated_at). Sub-project #2 will call getOrCreateProfile()
-- against this shape. Profile rows are created by app code, NOT by a trigger
-- on auth.users (which is shared with PropLedger).

create table if not exists act.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table act.profiles enable row level security;

-- Read/create/update only your own profile row.
create policy "profiles_select_own" on act.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on act.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on act.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-scoped grants so authenticated users can never write `role`.
-- The trigger below is the airtight backstop.
grant select on act.profiles to authenticated;
grant insert (id, email, full_name, avatar_url) on act.profiles to authenticated;
grant update (email, full_name, avatar_url) on act.profiles to authenticated;

-- updated_at maintenance (trigger on our own table — not shared infra).
create or replace function act.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on act.profiles
  for each row execute function act.set_updated_at();

-- Role-escalation guard. SAT app's CLAUDE.md documents the rationale: Supabase
-- re-grants table-level write privileges to anon/authenticated on tables in
-- exposed schemas, so column-scoped GRANTs aren't sufficient. This trigger
-- forces 'role' to 'student' on insert and silently keeps the existing role
-- on update for API roles. Privileged roles (postgres, service_role) are
-- unaffected. To promote: `update act.profiles set role='admin' where id=...`
-- as service_role.
create or replace function act.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = act, pg_temp
as $$
begin
  if (tg_op = 'INSERT') then
    if current_user in ('anon', 'authenticated') then
      new.role := 'student';
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if current_user in ('anon', 'authenticated') then
      new.role := old.role;
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before insert or update on act.profiles
  for each row execute function act.protect_profile_role();
```

- [ ] **Step 2: Apply via Supabase MCP**

Tool: `mcp__claude_ai_Supabase__apply_migration`
- `name`: `act_profiles`
- `query`: (the SQL from Step 1)

- [ ] **Step 3: Verify table exists**

Tool: `mcp__claude_ai_Supabase__list_tables` with `schemas: ['act']`

Expected: `act.profiles` appears with the 7 columns. RLS shows enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526000100_act_profiles.sql
git commit -m "feat(foundation): act.profiles with role-escalation guard"
```

---

### Task 9: act.passages table

**Files:**
- Create: `act-app/supabase/migrations/20260526000200_act_passages.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Foundation — act.passages.
-- Shared passage pool for English / Reading / Science. Multiple act.questions
-- rows point to the same passage via passage_id. See spec §3.2.

create table if not exists act.passages (
  id            uuid primary key default gen_random_uuid(),
  section       text not null check (section in ('english', 'reading', 'science')),
  passage_type  text not null check (passage_type in (
    'english_essay',
    'literary_narrative', 'social_science', 'humanities', 'natural_science',
    'data_representation', 'research_summaries', 'conflicting_viewpoints'
  )),
  title         text,
  body          text not null,
  stimuli       jsonb not null default '[]'::jsonb,
  enabled       boolean not null default true,
  dedup_hash    text unique,
  created_at    timestamptz not null default now()
);

-- Cross-check: passage_type must match section.
alter table act.passages add constraint passages_section_type_match check (
  (section = 'english' and passage_type = 'english_essay')
  or (section = 'reading' and passage_type in (
    'literary_narrative', 'social_science', 'humanities', 'natural_science'
  ))
  or (section = 'science' and passage_type in (
    'data_representation', 'research_summaries', 'conflicting_viewpoints'
  ))
);

create index passages_section_type_enabled_idx
  on act.passages (section, passage_type)
  where enabled;

alter table act.passages enable row level security;

-- Select-only RLS for authenticated users — they only see enabled passages.
-- Admins moderate disabled passages via the service-role client (sub-project #6),
-- which bypasses RLS entirely; there is no in-policy admin override (Supabase's
-- `request.jwt.claims.role` is the API role 'anon'/'authenticated', NOT the app
-- role stored in act.profiles.role — so a policy that checked the JWT claim
-- would never match). This mirrors the sat.questions / sat.questions_select_authenticated
-- posture.
create policy "passages_select_authenticated" on act.passages
  for select to authenticated
  using (enabled);

grant select on act.passages to authenticated;

-- dedup_hash auto-fill trigger. n8n inserts omit this column.
create or replace function act.passages_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.dedup_hash is null then
    new.dedup_hash := encode(
      digest(new.section || '|' || new.passage_type || '|' || new.body, 'sha256'),
      'hex'
    );
  end if;
  return new;
end;
$$;

create trigger passages_fill_defaults_trigger
  before insert on act.passages
  for each row execute function act.passages_fill_defaults();
```

**Note:** This migration uses `digest()` from the `pgcrypto` extension. SAT's PropLedger project already enables `pgcrypto` (it's a Supabase default). If `apply_migration` errors with "function digest does not exist", run a one-line prelude migration first: `create extension if not exists pgcrypto;` — but that should not be needed.

- [ ] **Step 2: Apply via Supabase MCP**

Tool: `apply_migration`, name `act_passages`.

- [ ] **Step 3: Verify**

Run `list_tables` with `schemas: ['act']`. Expected: `act.profiles` and `act.passages`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526000200_act_passages.sql
git commit -m "feat(foundation): act.passages with type-section check"
```

---

### Task 10: act.questions table

**Files:**
- Create: `act-app/supabase/migrations/20260526000300_act_questions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Foundation — act.questions.
-- Question pool. References act.passages for English/Reading/Science items
-- (NULL passage_id only for Math). See spec §3.3.

create table if not exists act.questions (
  id              uuid primary key default gen_random_uuid(),
  section         text not null check (section in ('english', 'math', 'reading', 'science')),
  skill           text not null,
  difficulty      smallint not null default 3 check (difficulty between 1 and 5),
  passage_id      uuid references act.passages(id) on delete cascade,
  passage_marker  smallint,
  stem            text not null,
  choices         jsonb not null,
  answer_key      text not null check (answer_key in ('A', 'B', 'C', 'D')),
  explanation     text not null,
  enabled         boolean not null default true,
  dedup_hash      text unique,
  created_at      timestamptz not null default now()
);

-- Per-section skill check. Mirrors SKILLS in app/lib/act/format.ts.
alter table act.questions add constraint questions_section_skill_match check (
  (section = 'english' and skill in (
    'production_of_writing', 'knowledge_of_language', 'conventions_of_standard_english'
  ))
  or (section = 'math' and skill in (
    'preparing_for_higher_math', 'integrating_essential_skills', 'modeling'
  ))
  or (section = 'reading' and skill in (
    'key_ideas_and_details', 'craft_and_structure', 'integration_of_knowledge'
  ))
  or (section = 'science' and skill in (
    'interpretation_of_data', 'scientific_investigation', 'evaluation_of_models'
  ))
);

-- passage_id presence rule: required for english/reading/science, null for math.
alter table act.questions add constraint questions_passage_required check (
  (section = 'math' and passage_id is null and passage_marker is null)
  or (section in ('english', 'reading', 'science') and passage_id is not null)
);

-- passage_marker is English-only.
alter table act.questions add constraint questions_marker_english_only check (
  (section = 'english' and passage_marker is not null)
  or (section <> 'english' and passage_marker is null)
);

create index questions_section_skill_enabled_idx
  on act.questions (section, skill)
  where enabled;

create index questions_passage_idx
  on act.questions (passage_id)
  where passage_id is not null;

alter table act.questions enable row level security;

-- Select-only RLS. Writes go through security-definer RPCs (sub-project #3)
-- or the service-role client (sub-project #6 admin).
create policy "questions_select_authenticated" on act.questions
  for select to authenticated
  using (enabled);

grant select on act.questions to authenticated;

-- dedup_hash auto-fill trigger.
create or replace function act.questions_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.dedup_hash is null then
    -- Per spec §3.10: sha256 of section + skill + stem + choices.
    -- Two questions with the same stem+choices but different passages would
    -- collide intentionally (still a duplicate question, regardless of which
    -- passage it references). passage_id is deliberately excluded.
    new.dedup_hash := encode(
      digest(
        new.section || '|' || new.skill || '|' || new.stem || '|' || (new.choices::text),
        'sha256'
      ),
      'hex'
    );
  end if;
  return new;
end;
$$;

create trigger questions_fill_defaults_trigger
  before insert on act.questions
  for each row execute function act.questions_fill_defaults();
```

- [ ] **Step 2: Apply migration**

Tool: `apply_migration`, name `act_questions`.

- [ ] **Step 3: Verify table & constraints**

Run `list_tables` with `schemas: ['act']`. Expected: `act.profiles`, `act.passages`, `act.questions`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526000300_act_questions.sql
git commit -m "feat(foundation): act.questions with section/skill/passage constraints"
```

---

### Task 11: act.test_attempts + act.attempt_responses

**Files:**
- Create: `act-app/supabase/migrations/20260526000400_act_test_attempts.sql`
- Create: `act-app/supabase/migrations/20260526000500_act_attempt_responses.sql`

- [ ] **Step 1: Write `20260526000400_act_test_attempts.sql`**

```sql
-- Foundation — act.test_attempts.
-- Holds the full mutable state of an in-progress attempt; survives refresh.
-- See spec §3.5 + §4 (state machine).

create table if not exists act.test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  status          text not null default 'in_progress'
                  check (status in ('in_progress', 'submitted', 'abandoned')),
  include_science boolean not null default true,
  current_section text check (current_section in (
    'english', 'math', 'break', 'reading', 'science'
  )),
  section_state   jsonb not null default '{}'::jsonb,
  raw_scores      jsonb not null default '{}'::jsonb,
  scaled_scores   jsonb not null default '{}'::jsonb,
  composite       smallint check (composite is null or composite between 1 and 36)
);

create index test_attempts_user_started_idx
  on act.test_attempts (user_id, started_at desc);

create index test_attempts_user_status_idx
  on act.test_attempts (user_id, status);

alter table act.test_attempts enable row level security;

-- Select-only RLS scoped to the owner. Writes go through security-definer
-- RPCs (act.draw_test, act.start_section, act.submit_section,
-- act.force_lock_section, act.finalize_attempt) — added in sub-projects
-- #3 and #4.
create policy "test_attempts_select_own" on act.test_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on act.test_attempts to authenticated;
```

- [ ] **Step 2: Apply `act_test_attempts`**

Tool: `apply_migration`, name `act_test_attempts`.

- [ ] **Step 3: Write `20260526000500_act_attempt_responses.sql`**

```sql
-- Foundation — act.attempt_responses.
-- One row per question presented in a test. See spec §3.6.

create table if not exists act.attempt_responses (
  attempt_id   uuid not null references act.test_attempts(id) on delete cascade,
  question_id  uuid not null references act.questions(id) on delete restrict,
  section      text not null check (section in ('english', 'math', 'reading', 'science')),
  selected     text check (selected is null or selected in ('A', 'B', 'C', 'D')),
  is_correct   boolean,
  -- In-test flag set by the user during the section (palette flag button).
  -- Persisted past section lock so the post-test review can surface
  -- "questions you flagged during the test". Distinct from act.question_flags
  -- which is the bad-question report system (sub-project #7).
  flagged      boolean not null default false,
  answered_at  timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index attempt_responses_attempt_section_idx
  on act.attempt_responses (attempt_id, section);

alter table act.attempt_responses enable row level security;

-- Select-only RLS; ownership inferred via the parent attempt.
create policy "attempt_responses_select_own" on act.attempt_responses
  for select to authenticated
  using (
    exists (
      select 1 from act.test_attempts a
      where a.id = attempt_responses.attempt_id
        and a.user_id = (select auth.uid())
    )
  );

grant select on act.attempt_responses to authenticated;
```

- [ ] **Step 4: Apply `act_attempt_responses`**

Tool: `apply_migration`, name `act_attempt_responses`.

- [ ] **Step 5: Verify both**

Run `list_tables`. Expected: `profiles`, `passages`, `questions`, `test_attempts`, `attempt_responses`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260526000400_act_test_attempts.sql supabase/migrations/20260526000500_act_attempt_responses.sql
git commit -m "feat(foundation): act.test_attempts + act.attempt_responses"
```

---

### Task 12: Remaining tables — score_scales, question_flags, generation_runs

**Files:**
- Create: `act-app/supabase/migrations/20260526000600_act_score_scales.sql`
- Create: `act-app/supabase/migrations/20260526000700_act_question_flags.sql`
- Create: `act-app/supabase/migrations/20260526000800_act_generation_runs.sql`

- [ ] **Step 1: Write `20260526000600_act_score_scales.sql`**

```sql
-- Foundation — act.score_scales.
-- Raw → scaled (1-36) lookup per section. Seeded by a later migration.
-- See spec §3.7.

create table if not exists act.score_scales (
  section       text not null check (section in ('english', 'math', 'reading', 'science')),
  raw_score     int not null check (raw_score >= 0),
  scaled_score  smallint not null check (scaled_score between 1 and 36),
  primary key (section, raw_score)
);

alter table act.score_scales enable row level security;

-- Public to all authenticated users (read-only); the scale itself isn't secret.
create policy "score_scales_select_authenticated" on act.score_scales
  for select to authenticated
  using (true);

grant select on act.score_scales to authenticated;
```

- [ ] **Step 2: Apply `act_score_scales`**

Tool: `apply_migration`, name `act_score_scales`.

- [ ] **Step 3: Write `20260526000700_act_question_flags.sql`**

```sql
-- Foundation — act.question_flags.
-- User-reported bad-question reports. Mirrors sat.question_flags posture:
-- RLS ENABLED with NO POLICIES — direct anon/authenticated read+write denied.
-- Users file via security-definer act.submit_flag (sub-project #7).
-- Admins read/resolve via service-role client behind requireAdmin().

create table if not exists act.question_flags (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  uuid not null references act.questions(id) on delete cascade,
  reason       text not null check (reason in ('incorrect_answer', 'ambiguous', 'typo', 'other')),
  notes        text,
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index question_flags_status_idx on act.question_flags (status);
create index question_flags_question_idx on act.question_flags (question_id);

alter table act.question_flags enable row level security;
-- No policies = no direct access for anon/authenticated. Deliberate.
```

- [ ] **Step 4: Apply `act_question_flags`**

Tool: `apply_migration`, name `act_question_flags`.

- [ ] **Step 5: Write `20260526000800_act_generation_runs.sql`**

```sql
-- Foundation — act.generation_runs.
-- n8n + Vercel cron bookkeeping. See spec §3.9.

create table if not exists act.generation_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  skill        text,
  target       int,
  produced     int not null default 0,
  errors       jsonb not null default '[]'::jsonb
);

create index generation_runs_started_idx on act.generation_runs (started_at desc);

alter table act.generation_runs enable row level security;
-- No policies. Read by service-role client (sub-project #6 admin).
```

- [ ] **Step 6: Apply `act_generation_runs`**

Tool: `apply_migration`, name `act_generation_runs`.

- [ ] **Step 7: Verify all 8 tables exist**

Run `list_tables` with `schemas: ['act']`.

Expected exactly 8 tables: `profiles`, `passages`, `questions`, `test_attempts`, `attempt_responses`, `score_scales`, `question_flags`, `generation_runs`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260526000600_act_score_scales.sql \
        supabase/migrations/20260526000700_act_question_flags.sql \
        supabase/migrations/20260526000800_act_generation_runs.sql
git commit -m "feat(foundation): act.score_scales + act.question_flags + act.generation_runs"
```

---

### Task 13: Seed act.score_scales

**Files:**
- Create: `act-app/supabase/migrations/20260526000900_seed_act_score_scales.sql`

**Context:** The spec (§3.7, post-revision) explicitly accepts a linear-interpolation v1 seed (raw 0 → scaled 1, raw N_max → scaled 36) with the option to swap in a real published ACT scale table via a later migration without code changes. The seed below implements that v1 — sufficient to exercise scoring end-to-end and produce a sensible 1–36 band, not calibrated to any specific published form. The seed is idempotent (`on conflict do nothing`); the upgrade path is one SQL file.

- [ ] **Step 1: Write the seed migration**

```sql
-- Foundation — seed act.score_scales with an Enhanced-ACT-shaped mapping.
-- For each section, raw 0..N (N = section question count) → scaled 1..36
-- via smooth linear interpolation across the raw range. Replace with a
-- specific published form later if calibration matters.

-- Helper: insert a section's mapping by interpolating between (0, 1) and (max_raw, 36).
do $$
declare
  s text;
  max_raw int;
  r int;
  scaled smallint;
begin
  for s, max_raw in
    select * from (values
      ('english', 50),
      ('math', 45),
      ('reading', 36),
      ('science', 40)
    ) as t(s, max_raw)
  loop
    for r in 0..max_raw loop
      -- Linear interpolation: raw 0 -> scaled 1, raw max -> scaled 36.
      -- round to nearest integer; clamp to [1, 36].
      scaled := greatest(
        1,
        least(36, round(1 + (35.0 * r / max_raw)))::smallint
      );
      insert into act.score_scales (section, raw_score, scaled_score)
      values (s, r, scaled)
      on conflict (section, raw_score) do nothing;
    end loop;
  end loop;
end $$;
```

- [ ] **Step 2: Apply the seed migration**

Tool: `apply_migration`, name `seed_act_score_scales`.

- [ ] **Step 3: Verify seed rows**

Tool: `mcp__claude_ai_Supabase__execute_sql` with project_id `falgykkspbtrwdcchayi`:

```sql
select section, count(*) as rows,
       min(raw_score) as min_raw, max(raw_score) as max_raw,
       min(scaled_score) as min_scaled, max(scaled_score) as max_scaled
from act.score_scales
group by section
order by section;
```

Expected (exact):
| section | rows | min_raw | max_raw | min_scaled | max_scaled |
|---------|------|---------|---------|------------|------------|
| english | 51   | 0       | 50      | 1          | 36         |
| math    | 46   | 0       | 45      | 1          | 36         |
| reading | 37   | 0       | 36      | 1          | 36         |
| science | 41   | 0       | 40      | 1          | 36         |

If any row count is off, the seed loop has a bug — fix and re-apply.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526000900_seed_act_score_scales.sql
git commit -m "feat(foundation): seed act.score_scales with linear 1-36 mapping per section"
```

---

## Chunk 4: Vercel Deploy + Verification

### Task 14: Set up GitHub repo + push

**Files:** none (remote setup)

> **User-confirmation gate:** This task creates a new repository on GitHub under the user's account — a non-reversible external action. Before running `gh repo create`, confirm with the user:
> - Repo owner + name (default: `abhiagri15/act-app`)
> - Visibility (default: `--private`)
> Only proceed when the user explicitly approves.

- [ ] **Step 1: Confirm repo name and visibility with the user**

Ask: "About to create GitHub repo `abhiagri15/act-app` as private. OK to proceed, or change the name/visibility?"

Wait for explicit approval before running Step 2.

- [ ] **Step 2: Create the GitHub repo**

Run: `gh repo create abhiagri15/act-app --private --source=. --remote=origin --description "Enhanced ACT practice platform"`

Expected: confirms creation with the new URL.

If `gh` is not authenticated, run `gh auth login` first.

- [ ] **Step 3: Push main**

```bash
git push -u origin main
```

Expected: branch tracking confirmation; no errors.

- [ ] **Step 4: Verify remote**

Run: `git remote -v`
Expected: `origin git@github.com:abhiagri15/act-app.git (fetch)` and `(push)` (or HTTPS form).

---

### Task 15: Wire up Vercel project + env vars

> **User-confirmation gate:** This task creates a new Vercel project, sets production secrets, and triggers the first production deploy — all non-trivial shared-state actions. Before running `pnpm dlx vercel link`, confirm with the user that the project name (`act-app`) and Vercel scope/team are correct. Before Step 6 (the deploy itself), confirm all env vars are set across Production + Preview + Development.

**Files:**
- Create: `act-app/vercel.json` (cron stub for #3; harmless no-op for now)

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/admin/generate-questions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

The cron path doesn't exist yet (sub-project #3 creates it). Vercel may surface a one-line warning during build ("cron path may not exist") but will not fail the deploy. The cron is committed now so the env-var setup later doesn't need a re-deploy.

- [ ] **Step 2: Create the Vercel project**

Run: `pnpm dlx vercel link --yes`

This prompts for the project name (use `act-app`) and links the directory. If it asks "is this an existing project?", answer "no, create new".

- [ ] **Step 3: Set the required env vars (Production scope)**

The user needs to provide the actual secret values. Ask the user for:
- `NEXT_PUBLIC_SUPABASE_URL` (default: `https://falgykkspbtrwdcchayi.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase dashboard, same as SAT)
- `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard, same as SAT)
- `CRON_SECRET` — generate a fresh one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Set each in Vercel:

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add CRON_SECRET production
```

Each command will prompt for the value. Defer the AI provider vars (OLLAMA_*) until sub-project #3.

- [ ] **Step 4: Mirror env vars to Preview and Development scopes**

Repeat each `vercel env add` with `preview` and `development` scopes, or use the Vercel dashboard's "Apply to all environments" option. The middleware will crash with `MIDDLEWARE_INVOCATION_FAILED` if `NEXT_PUBLIC_SUPABASE_*` is missing on any environment — every matched route would 500.

- [ ] **Step 5: Commit `vercel.json`**

```bash
git add vercel.json
git commit -m "feat(foundation): vercel.json with daily cron stub"
git push
```

- [ ] **Step 6: Trigger first deploy (confirm with user first)**

**Confirm with the user that Vercel env vars are set on all 3 scopes**, then:

Run: `pnpm dlx vercel --prod`

Expected: build succeeds, deploy URL is printed.

If build fails:
- **"Cannot find module" errors** → re-run `pnpm install` locally to make sure the lockfile is current, push.
- **"Vulnerable version of Next.js"** → Vercel security gate caught a CVE. Bump `next` to the latest patch within 15.5.x and re-deploy.
- **Edge middleware crash** → an env var is missing on Production. Use `pnpm dlx vercel env ls` to verify.

- [ ] **Step 7: Smoke-test the deploy**

Save the production URL the previous step printed (e.g. `https://act-app-xxx.vercel.app`).

```bash
curl https://<the-url>/
curl https://<the-url>/how-it-works
```

Both should return 200 with HTML content. The home page must contain "ACT Practice"; the how-it-works page must contain "Composite score 1–36" and the 50/45/36/40 question counts.

If either 500s, the most likely cause is a missing env var on Production — re-check `vercel env ls`.

---

### Task 16: Configure Supabase URL settings + Exposed Schemas (load-bearing)

This step touches the shared PropLedger Supabase project's settings. **Coordinate with the user** — these changes also affect the SAT app's auth redirects if not done correctly.

- [ ] **Step 1: Add `act` to Exposed Schemas**

In the Supabase dashboard (PropLedger project `falgykkspbtrwdcchayi`):
- Settings → API → Exposed schemas
- Confirm `public` and `sat` are already there
- Add `act`
- Save

- [ ] **Step 2: Verify `act` is exposed via PostgREST**

Tool: `mcp__claude_ai_Supabase__list_tables` with `schemas: ['act']`

Expected: returns the 8 tables we created.

Then probe PostgREST directly to confirm REST exposure:

```bash
curl "https://falgykkspbtrwdcchayi.supabase.co/rest/v1/score_scales?select=section,raw_score,scaled_score&section=eq.english&raw_score=eq.0" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Accept-Profile: act"
```

Expected: returns a JSON array with one row `{ section: "english", raw_score: 0, scaled_score: 1 }`.

If it returns `[]` or 404, the schema is not exposed. Fix Step 1 before continuing.

- [ ] **Step 3: Update Supabase URL Configuration for the Vercel domain**

Authentication → URL Configuration → Redirect URLs:
- Confirm the SAT URL is still there (don't remove it).
- Add: `https://<your-vercel-prod-url>/**`
- Add: `http://localhost:3000/**` (if not already there for SAT)

Site URL: leave as-is (SAT's URL or whichever the dashboard already shows). Sub-project #2 (Auth) will revisit Site URL handling.

- [ ] **Step 4: Commit a note in CLAUDE.md (optional but recommended)**

Create `act-app/CLAUDE.md` with the same shape as SAT's, but Foundation-scoped:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm type-check
pnpm dlx tsx scripts/check-format.ts
```

## Architecture

Foundation scaffold only as of this commit. See
`docs/superpowers/specs/2026-05-26-act-app-overview-design.md` for the
overall architecture and the 7 sub-project plan.

## Auth gotchas

- **The `act` schema MUST be exposed in Supabase API settings.** The app
  will query `act.profiles` via `supabase.schema('act').from('profiles')`
  (added in sub-project #2). Without exposure, every authenticated page
  errors. One-time dashboard action on the Property Ledger project
  (`falgykkspbtrwdcchayi`). This Foundation already added it; verify
  before deploying sub-project #2.

## Things that will bite you

- **`app/lib/supabase/admin.ts` is SERVER-ONLY.** Importing it from a
  `'use client'` module bundles `SUPABASE_SERVICE_ROLE_KEY` into the
  browser. Verification command:
  ```powershell
  Get-ChildItem -Path app -Recurse -Include *.tsx,*.ts | Select-String -Pattern "supabase/admin|SUPABASE_SERVICE_ROLE_KEY"
  ```
  Expected: matches only in `app/lib/supabase/admin.ts` (and `app/lib/ai/*.ts` once sub-project #3 lands).

- **Migrations apply to the live PropLedger DB.** There is no local
  Supabase. Use the Supabase MCP `apply_migration` tool. The migrations
  in `supabase/migrations/` are committed only for reproducibility.

- **Orphan `next dev` processes survive Ctrl+C.** If the next `pnpm dev`
  lands on port 3001 instead of 3000, kill stray node processes:
  ```powershell
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*act-app*" } | Stop-Process -Force -Confirm:$false
  ```
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(foundation): CLAUDE.md with Foundation-scoped gotchas"
git push
```

---

### Task 17: Final verification + tag

- [ ] **Step 1: Re-run all checks**

```bash
pnpm install
pnpm type-check
pnpm build
pnpm dlx tsx scripts/check-format.ts
```

All four must pass with no errors.

- [ ] **Step 2: Verify the service-role-key leak guard**

Run from `act-app/`:

```powershell
Get-ChildItem -Path app -Recurse -Include *.tsx,*.ts | Select-String -Pattern "supabase/admin|SUPABASE_SERVICE_ROLE_KEY"
```

Expected output: matches ONLY in `app/lib/supabase/admin.ts`. If any other file matches, that's a leak — investigate and fix.

- [ ] **Step 3: Verify the live deploy still works**

```bash
curl https://<vercel-prod-url>/
curl https://<vercel-prod-url>/how-it-works
```

Both 200; both contain the expected text.

- [ ] **Step 4: Verify Exposed Schemas one more time (load-bearing)**

Tool: `mcp__claude_ai_Supabase__execute_sql`:

```sql
select n.nspname as schema, count(*) as table_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'act' and c.relkind = 'r'
group by n.nspname;
```

Expected: one row, `schema=act`, `table_count=8`.

Then probe REST:

```bash
curl "https://falgykkspbtrwdcchayi.supabase.co/rest/v1/score_scales?limit=1" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Accept-Profile: act"
```

Expected: a JSON array with one row.

If REST 404s but `list_tables` works, the schema is in the DB but not exposed in API settings — go back to Task 16 Step 1.

- [ ] **Step 5: Tag the release**

```bash
git tag post-foundation
git push --tags
```

- [ ] **Step 6: Final commit (if any pending) + summary**

If any changes are uncommitted:

```bash
git status
git add <relevant files>
git commit -m "chore(foundation): final verification updates"
git push
```

Report to the user:
- The Vercel production URL
- The GitHub repo URL
- Confirmation that all 8 `act` tables exist and `act` is in Exposed Schemas
- Confirmation that `pnpm type-check`, `pnpm build`, and `check-format.ts` all pass
- Confirmation that the admin-client leak guard finds matches only in expected files

Foundation is complete. Sub-project #2 (Auth) is unblocked.

---

## Done When

- [ ] `act-app/` directory exists with Next.js 15 + TS strict scaffold
- [ ] `pnpm type-check` exits 0
- [ ] `pnpm build` succeeds locally
- [ ] `pnpm dlx tsx scripts/check-format.ts` prints "All format invariants OK."
- [ ] GitHub repo `abhiagri15/act-app` exists with `main` branch pushed
- [ ] Vercel project linked, env vars set on Production+Preview+Development, deploy succeeds
- [ ] Vercel prod URL serves `/` and `/how-it-works` with expected content
- [ ] All 8 `act` tables exist on PropLedger Supabase (verified via `list_tables`)
- [ ] `act.score_scales` has 51+46+37+41 = 175 rows (verified via `execute_sql`)
- [ ] `act` schema is in Supabase Exposed Schemas (verified via PostgREST probe)
- [ ] `app/lib/supabase/admin.ts` leak guard returns matches only in expected files
- [ ] Tag `post-foundation` pushed to GitHub
