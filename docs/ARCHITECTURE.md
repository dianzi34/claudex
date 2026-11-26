# ClaudeX — Architecture

Status: draft for HW4. Owner: Xinyu Li. Reviewer: Bo Pang.

## 1. Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Vitest 5 with V8
coverage, ESLint 9 (`eslint-config-next` + Prettier), Prettier 3, npm, Node 24.
Import alias: `@/` → `src/`.

## 2. Layers

```
src/
  domain/   pure TypeScript business rules (HW4: workflow/)
  app/      Next.js App Router: pages, layouts, route handlers
  infra/    adapters to the outside world: database, AI providers (not built yet)
tests/
  unit/     Vitest unit tests, mirroring src/ (tests/unit/workflow/ ↔ src/domain/workflow/)
```

| Layer    | May import              | Must not import                                    |
| -------- | ----------------------- | -------------------------------------------------- |
| `domain` | other `domain` modules  | `app`, `infra`, `next`, `react`, Node I/O, any SDK |
| `app`    | `domain`, `infra`       | —                                                  |
| `infra`  | `domain` (types, ports) | `app`                                              |

Dependencies point inward: the domain knows nothing about the framework, the
database or the AI provider. When infra arrives, the domain defines the
interfaces (ports) it needs and infra implements them.

## 3. Decisions

### D1 — The workflow state machine is pure domain code

Location: `src/domain/workflow/`. It takes a workflow value and an event and
returns the next workflow value. No timers, no I/O, no randomness, no
`Date.now()` inside transitions (time, if needed, is passed in).

Why: the Worker → Reviewer → revise loop is the core rule of the product. Pure
functions can be tested exhaustively with fast unit tests, which is what the
HW4 TDD cycles need, and the same logic can later run in a route handler, a
background job or the browser.

### D2 — Workflow values are immutable

A transition never mutates its input; it returns a new value. A failed
transition leaves the original value exactly as it was (PRD AC-11, AC-12).

Why: makes "the workflow is unchanged" trivially testable and avoids
half-applied transitions.

### D3 — No external libraries for the state machine

A transition table in plain TypeScript, not XState or similar.

Why: seven states and a handful of events do not justify a dependency, and a
hand-written table keeps every rule visible in one file.

### D4 — Tests live in `tests/unit/`, not next to source

Matches the existing `vitest.config.mts` (`include: tests/**/*.test.ts`).
Coverage is measured over `src/**/*.ts`.

## 4. Current state

The state machine design is final in `docs/plans/workflow-state-machine.md`:
public API in §4, error semantics (typed errors are thrown) in §3, and the test
layout in §6. The code is built in three TDD rounds (R1–R3) under
`src/domain/workflow/`, with tests in `tests/unit/workflow/`. `src/infra/` does
not exist yet.

The scaffold's smoke test (`tests/unit/smoke.test.ts`) is deleted in R1 (plan
§7). After that, the workflow tests cover the `@/` alias, because they import
`@/domain/workflow`.
