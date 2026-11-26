# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClaudeX — a multi-agent workbench: a Worker agent produces a result, a Reviewer agent checks it against acceptance criteria, revisions are capped, and a human gives final approval. The HW4 feature is the pure-domain workflow state machine (`src/domain/workflow/`). Product requirements and acceptance criteria (AC-01 … AC-12):

@docs/PRD.md

The README is unmodified `create-next-app` boilerplate (its `app/page.tsx` path is wrong; source lives under `src/`).

## Tech stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Vitest 5 + V8 coverage, ESLint 9, Prettier 3, npm, Node 24.

```bash
npm run dev            # Next dev server on http://localhost:3000
npm run build          # production build
npm run lint           # ESLint (next core-web-vitals + typescript + prettier)
npm run typecheck      # tsc --noEmit
npm run format:check   # Prettier check (npm run format to write)
npm test               # vitest run (all tests once)
npm run test:watch
npm run test:coverage  # v8 coverage, text + html in coverage/

npx vitest run tests/unit/smoke.test.ts   # single file
npx vitest run -t "AC-06"                 # single test / AC by name
```

## Architecture decisions

- Layers: `src/domain/` (pure business rules), `src/app/` (Next.js), `src/infra/` (adapters, not built yet). Dependencies point inward — `domain` imports nothing from `app`, `infra`, `next`, `react`, Node I/O or any SDK.
- D1: the workflow state machine is pure domain code (workflow + event → next workflow).
- D2: workflow values are immutable; a failed transition leaves the input unchanged.
- D3: plain-TypeScript transition table, no XState or similar.
- D4: tests live in `tests/unit/`, not next to source.
- State machine API and error semantics are decided in `docs/plans/workflow-state-machine.md` (stage ②).

@docs/ARCHITECTURE.md

Config notes not covered there:

- **Next.js 16** with `cacheComponents` and `partialPrefetching` in `next.config.ts` — use the Cache Components model (`"use cache"`, Suspense for dynamic data), not the old `fetch`-cache/route-segment-config model. Typed route helpers like `LayoutProps<"/">` are Next-generated globals.
- **Tailwind v4** runs through Turbopack: `*.css` uses the `@tailwindcss/turbopack` loader (no PostCSS config, no `tailwind.config`). `globals.css` is imported in `src/app/layout.tsx`.
- **Path alias** `@/*` → `src/*` is defined in both `tsconfig.json` and `vitest.config.mts` — keep them in sync.

## Coding conventions

- TypeScript `strict`; no `any` (`@typescript-eslint/no-explicit-any` via `eslint-config-next/typescript`). `isolatedModules` is on — use `import type` for type-only imports.
- Import from `src/` via `@/…`, not long relative paths.
- Formatting is Prettier defaults (`.prettierrc` is `{}`): double quotes, semicolons, 2-space indent, trailing commas, 80-column width. ESLint defers formatting to Prettier — don't hand-format against it.
- Domain code (`src/domain/`) is pure and immutable: no mutation of inputs, no I/O, timers, randomness or `Date.now()` (pass time in); return new values with `readonly` types.

## Testing strategy

Strict TDD, one acceptance criterion per red → green → refactor cycle; the failing test is committed on its own first. Tests live in `tests/unit/` mirroring `src/domain/`, use `.test.ts` (`.test.tsx` is not collected; no jsdom/RTL yet), and every test name starts with its AC id. Assert behaviour, edge cases and immutability. Coverage counts only `src/**/*.ts`. Commit format and details:

@docs/TESTING.md

## Do's and don'ts

- Do keep each change scoped to one issue/AC; update the PRD/ARCHITECTURE/TESTING docs when a decision changes, rather than restating it here.
- Do run `lint`, `typecheck`, `format:check` and `test` before opening a PR.
- Don't add runtime dependencies to domain code (`src/domain/`) — no state-machine library or anything else. Other layers may add one only after both teammates agree in the PR.
- Don't build AI provider calls, persistence or UI for HW4 — out of scope (PRD §3).
- Don't write implementation in a red commit, or tests in a green commit.
- Don't put secrets in code or `NEXT_PUBLIC_` vars; copy `.env.example` to `.env.local` (never committed).

## Team workflow rules

This is a two-person course project (graded on authentic Claude Code workflow and TDD history):

- One issue → one branch → one PR. Never push directly to `main`.
- TDD: commit the failing test on its own first, then the implementation. Never rewrite history to manufacture RED→GREEN evidence.
- Commits must **not** carry AI attribution (no `Co-Authored-By: Claude` trailers). Record AI usage in the PR description instead (tools used, rough AI %, human review done).
- Evidence (logs, test output, standups) must be real; mark gaps as "待补" rather than filling them in. Redact keys and local paths.
- Force-push, history rewrites and deploys need both teammates' confirmation.
