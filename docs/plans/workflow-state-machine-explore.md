# Workflow State Machine — Explore Notes

Stage ② (Explore) for the HW4 workflow state machine. No code was written.

Method: Glob, Grep and Read only (no shell).

- Glob: `src/**`, `tests/**`, `docs/**` and the root config files.
- Read: `vitest.config.mts`, `tsconfig.json`, `tests/unit/smoke.test.ts`,
  `package.json`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `eslint.config.mjs`,
  `.prettierrc` and `README.md`.
- Grep: `workflow|state|domain` (case-insensitive) in `src/` and `tests/`.

## What exists

**Layout (checked with Glob):**

```
src/app/          globals.css, layout.tsx, page.tsx   (Next.js scaffold only)
tests/unit/       smoke.test.ts                        (only test)
docs/             PRD.md, ARCHITECTURE.md
docs/plans/       this file
config            package.json, tsconfig.json, vitest.config.mts, eslint.config.mjs,
                  next.config.ts, .prettierrc ({} = defaults), .prettierignore
```

`src/domain/` and `src/infra/` don't exist yet. There's no `CLAUDE.md`,
`.github/` or `.claude/` in the repo, and the README is the stock
create-next-app one.

**Existing workflow, state or domain code:** none. Grep for
`workflow|state|domain` in `src/` and `tests/` found nothing, which confirms
ARCHITECTURE.md §4.

**Stack (`package.json`):** Next.js 16.4.6, React 19.3, TypeScript 5 in strict
mode, Vitest 5.1 with `@vitest/coverage-v8`, ESLint 9 (`eslint-config-next`
core-web-vitals and typescript configs, plus `eslint-config-prettier`), and
Prettier 3 with default settings. The scripts are `test` (`vitest run`),
`test:coverage`, `typecheck` (`tsc --noEmit`), `lint`, `format` and
`format:check`. The only runtime dependencies are next, react and react-dom.

**Test setup:**

- `vitest.config.mts` runs in the `node` environment and only picks up
  `tests/**/*.test.ts`.
- Coverage is measured with V8 over `src/**/*.ts`, so `.tsx` files are
  excluded. No coverage threshold is set.
- The `@` alias points to `./src`.
- `tsconfig.json` uses `strict: true`, `moduleResolution: bundler`,
  `isolatedModules` and `@/*` → `./src/*`. It includes `**/*.mts`, so the
  Vitest config is type-checked too.
- `tests/unit/smoke.test.ts` only checks that `@/app/page` resolves through the
  alias. Its comment says to delete it once real feature tests exist.

## Rules the state machine must follow

1. **Where files go:** code in `src/domain/workflow/`, tests in
   `tests/unit/workflow/*.test.ts` (ARCHITECTURE D4). A test outside
   `tests/**/*.test.ts` won't run.
2. **Imports:** domain code may import only other domain code. No `app`,
   `infra`, `next`, `react`, Node I/O or SDKs.
3. **Pure transitions (D1):** each transition takes a workflow and an event and
   returns the next workflow. No timers, I/O, randomness or `Date.now()`; any
   time value is passed in.
4. **Immutable values (D2):** a transition never changes its input, and a
   failed one leaves the input exactly as it was (AC-11, AC-12).
5. **No library (D3):** a hand-written transition table in plain TypeScript,
   not XState.
6. **States:** the 7 states are `pending`, `generating`, `in_review`,
   `revising`, `awaiting_human`, `completed` and `rejected`; the last two are
   terminal. Strict TypeScript suggests a string-literal union.
7. **Revision cap:** the default `maxRevisions` is 3 and must be a positive
   integer (AC-02).
   - A Reviewer rejection while `revisionRound < max` goes to `revising` and
     adds 1 to `revisionRound`.
   - A rejection when `revisionRound === max` goes to `awaiting_human`,
     doesn't add 1, and marks the workflow as having hit the cap.
8. **Behaviour:** AC-01 to AC-12, split into three TDD rounds:
   - Round 1: creation and generation.
   - Round 2: review and human approval.
   - Round 3: the cap, errors and edge cases.
9. **Formatting:** Prettier defaults (double quotes, semicolons), which matches
   the existing files.

## Open questions for the design

**From PRD §4.4:**

- **Errors:** throw typed errors (`InvalidTransitionError`,
  `ValidationError`) or return a `Result` type? Throwing makes "the workflow is
  unchanged" easy to test. A `Result` makes the failure part of the function's
  type.
- **Cap flag:** it probably needs its own stored field, such as `reachedCap`.
  It can't be worked out from the other values, because a Reviewer _approval_
  when `revisionRound === max` also lands in `awaiting_human` without hitting
  the cap.
- **Owner approval after a cap hit:** the current draft says yes (AC-08
  applies to any `awaiting_human` workflow).

**Not yet covered in the docs:**

- **API shape:** one `transition(workflow, event)` over a union of events, or
  one function per event (`startGeneration`, `submitResult`, …)? D3's single
  visible table points to the first.
- **Events:** what they are called and what they carry (result text, feedback,
  reason). Should Worker and Reviewer events be split by who sends them?
- **Creation input:** AC-01 needs a description and acceptance criteria. Should
  an empty description or empty acceptance criteria be refused, the way AC-12
  refuses empty feedback? No AC covers this.
- **Owner's reason:** can the AC-10 rejection reason be empty or
  whitespace-only? AC-12 only covers Reviewer feedback.
- **Feedback storage:** keep only the latest feedback, or a list? Full history
  is P1, but storing a list now could make that easier later.
- **How to enforce immutability:** `readonly` types, `Object.freeze`, or both?
  And should AC-11 tests check deep equality, the same reference, or both?
- **Identity and time:** does a workflow need an `id` or timestamps now? D1
  says time must be passed in, and no AC requires it yet.
- **Coverage:** should we set a threshold? None is configured.
- **Smoke test:** delete it once the Round 1 tests land, as its comment says?
