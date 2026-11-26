# Workflow State Machine — Plan

Status: final for HW4. It is based on `docs/PRD.md` §4 (AC-01..AC-12) and
`docs/plans/workflow-state-machine-explore.md`. The implementation is done in
the TDD stage, using the rounds in §5.

## Context

HW4 builds only the pure domain logic for ClaudeX's Worker → Reviewer → revise
loop. Exploration confirmed there is no domain code yet. Only the Next.js
scaffold and a smoke test exist. The architecture already fixes these rules:

- The code goes in `src/domain/workflow/` and the tests in
  `tests/unit/workflow/`.
- Transitions are pure functions over immutable values (D1, D2).
- No state-machine library is used (D3).
- The tests must match `tests/**/*.test.ts`, and coverage is measured over
  `src/**/*.ts` (D4).

This plan settles the design, the API, the TDD rounds and every open question,
so the TDD stage can start without making new decisions.

## 1. States and transition table

States: `pending`, `generating`, `in_review`, `revising`, `awaiting_human`,
`completed` and `rejected`. `completed` and `rejected` are terminal and accept
no events.

| Event              | From             | To               | Guard                                                        | Effect                                                  |
| ------------------ | ---------------- | ---------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `START_GENERATION` | `pending`        | `generating`     | —                                                            | —                                                       |
| `SUBMIT_RESULT`    | `generating`     | `in_review`      | —                                                            | `latestResult = result`                                 |
| `SUBMIT_RESULT`    | `revising`       | `in_review`      | —                                                            | `latestResult = result` (replaces the old one)          |
| `REVIEW_APPROVE`   | `in_review`      | `awaiting_human` | —                                                            | —                                                       |
| `REVIEW_REJECT`    | `in_review`      | `revising`       | `feedback` is not blank and `revisionRound < maxRevisions`   | `revisionRound + 1`, feedback appended                  |
| `REVIEW_REJECT`    | `in_review`      | `awaiting_human` | `feedback` is not blank and `revisionRound === maxRevisions` | `reachedCap = true`, feedback appended, round unchanged |
| `OWNER_APPROVE`    | `awaiting_human` | `completed`      | —                                                            | —                                                       |
| `OWNER_REJECT`     | `awaiting_human` | `rejected`       | `reason` is not blank                                        | `rejectionReason = reason`                              |

Any (state, event) pair that isn't in the table throws
`InvalidTransitionError`.

"Blank" means `text.trim() === ""`. Text is stored exactly as given, without
trimming. The Worker's `result` is not checked for blanks.

**Check order:** whether the event is allowed in the current state is checked
first, and the payload second. For example, a `REVIEW_REJECT` with empty
feedback sent while the workflow is `pending` throws `InvalidTransitionError`,
not `ValidationError`.

The table is a plain
`Record<WorkflowState, Partial<Record<WorkflowEventType, Handler>>>` in
`transition.ts`, so every rule is visible in one place (D3).

## 2. Revision round and the cap

- `revisionRound` is the number of Reviewer rejections that sent the task to
  `revising`. It starts at 0.
- The invariant is `0 ≤ revisionRound ≤ maxRevisions` at all times.
- With `maxRevisions = N`, the Worker produces at most N+1 results (the first
  one plus N revisions), and the Reviewer reviews at most N+1 times.
- Rejections number 1 to N go to `revising` and add 1 to `revisionRound`.
- Rejection N+1 arrives while `revisionRound === N`. It goes to
  `awaiting_human`, leaves `revisionRound` at N, sets `reachedCap = true` and
  still stores the feedback.
- `reachedCap` is a stored boolean and can't be worked out from the other
  fields. A Reviewer _approval_ when `revisionRound === N` also lands in
  `awaiting_human` with `reachedCap = false`. Once set, `reachedCap` stays
  true, including after the workflow reaches a terminal state.
- `maxRevisions` must satisfy `Number.isInteger(n) && n > 0`. This rejects 0,
  negative numbers, fractions, `NaN` and `Infinity`. The default is 3.

## 3. Error semantics: throw typed errors

```ts
export class WorkflowError extends Error {} // common base
export class InvalidTransitionError extends WorkflowError {
  readonly state: WorkflowState;
  readonly eventType: WorkflowEventType;
}
export class ValidationError extends WorkflowError {
  readonly field: string; // e.g. "feedback", "reason", "maxRevisions"
}
```

Each class sets `this.name`. Throwing is chosen over a `Result` type for these
reasons:

- Nothing calls this code yet, so a `Result` would only add unwrapping
  boilerplate.
- `expect(() => …).toThrow(InvalidTransitionError)` maps directly onto the
  wording of AC-11 and AC-12.
- The input is frozen and never mutated, so a throw can't leave a half-applied
  transition behind (D2).

## 4. Public API (`src/domain/workflow/index.ts`)

```ts
export type WorkflowState =
  | "pending"
  | "generating"
  | "in_review"
  | "revising"
  | "awaiting_human"
  | "completed"
  | "rejected";

export type WorkflowEvent =
  | { readonly type: "START_GENERATION" }
  | { readonly type: "SUBMIT_RESULT"; readonly result: string }
  | { readonly type: "REVIEW_APPROVE" }
  | { readonly type: "REVIEW_REJECT"; readonly feedback: string }
  | { readonly type: "OWNER_APPROVE" }
  | { readonly type: "OWNER_REJECT"; readonly reason: string };
export type WorkflowEventType = WorkflowEvent["type"];

export interface Workflow {
  readonly state: WorkflowState;
  readonly description: string;
  readonly acceptanceCriteria: readonly string[];
  readonly maxRevisions: number;
  readonly revisionRound: number;
  readonly reachedCap: boolean;
  readonly latestResult: string | null;
  readonly reviewFeedback: readonly string[]; // oldest first; the last item is the latest
  readonly rejectionReason: string | null;
}

export interface CreateWorkflowInput {
  description: string;
  acceptanceCriteria: readonly string[];
  maxRevisions?: number; // default 3
}

export const DEFAULT_MAX_REVISIONS = 3;
export function createWorkflow(input: CreateWorkflowInput): Workflow; // throws ValidationError
export function transition(workflow: Workflow, event: WorkflowEvent): Workflow; // throws InvalidTransitionError | ValidationError
export function isTerminal(state: WorkflowState): boolean;
export { WorkflowError, InvalidTransitionError, ValidationError };
```

Event names follow the actor who sends them: Worker → `SUBMIT_RESULT`,
Reviewer → `REVIEW_*`, Owner → `OWNER_*`. `START_GENERATION` comes from the
system. Every returned workflow is frozen with `Object.freeze`, and so are its
arrays.

## 5. Acceptance criteria in 3 TDD rounds

Each round has three steps: write the failing tests (red), write the minimum
code to pass them (green), then refactor while the tests stay green.

**R1: creation and generation**

- AC-01: `createWorkflow` with no cap gives state `pending`,
  `revisionRound` 0, `maxRevisions` 3, `reachedCap` false,
  `latestResult` null, `reviewFeedback` [] and `rejectionReason` null.
  With a valid cap (for example `maxRevisions: 5`) the workflow keeps that
  value.
- AC-02: `maxRevisions` of 0, -1, 1.5, NaN or Infinity throws
  `ValidationError` (`field: "maxRevisions"`). The description and the
  acceptance criteria are not validated (out of scope, see §7).
- AC-03: `pending` + `START_GENERATION` → `generating`.
- AC-04: `generating` + `SUBMIT_RESULT` → `in_review`, and `latestResult` is
  set.
- Also in R1: delete `tests/unit/smoke.test.ts`. The workflow tests import
  `@/domain/workflow`, so they already cover the `@/` alias.

**R2: review and human approval**

- AC-05: `in_review` + `REVIEW_APPROVE` → `awaiting_human`, with `reachedCap`
  false.
- AC-06: `in_review` + `REVIEW_REJECT` with round < max → `revising`. The
  round goes up by 1 and the feedback is appended.
- AC-07: `revising` + `SUBMIT_RESULT` → `in_review`. `latestResult` is
  replaced and the round is unchanged.
- AC-08: `awaiting_human` + `OWNER_APPROVE` → `completed`. This also works
  after a cap hit.

**R3: cap, errors and edge cases**

- AC-09: `in_review` + `REVIEW_REJECT` with round === max → `awaiting_human`.
  The round is unchanged, `reachedCap` becomes true and the feedback is
  appended. The test runs a full loop with N = 3 and checks rejections 1 to 3,
  then rejection 4.
- AC-10: `awaiting_human` + `OWNER_REJECT` → `rejected`, and
  `rejectionReason` is stored.
- AC-11: every (state, event) pair not in the table throws
  `InvalidTransitionError`. This includes all 6 events in each of the two
  terminal states. The workflow must be unchanged, checked against a
  `structuredClone` deep-equal snapshot. The test is generated with `it.each`
  from the complement of the table, and the error's `state` and `eventType`
  are asserted. The check-order rule from §1 gets its own test.
- AC-12: blank (`""` or whitespace-only) Reviewer feedback or Owner reason
  throws `ValidationError` and leaves the workflow unchanged.
- Immutability: a successful transition returns a new object, the input still
  deep-equals its snapshot, and the returned value is frozen.

## 6. File layout and naming

```
src/domain/workflow/
  types.ts             states, events, Workflow, CreateWorkflowInput
  errors.ts            WorkflowError, InvalidTransitionError, ValidationError
  create-workflow.ts   createWorkflow + maxRevisions validation
  transition.ts        transition table, transition(), isTerminal()
  index.ts             public exports only; tests import from "@/domain/workflow"
tests/unit/workflow/
  fixtures.ts                  helpers: validInput(), workflowIn(state, opts) reaches a
                               state by replaying real events, so no fake states;
                               not a *.test.ts file, so it isn't run as a test
  create-workflow.test.ts      R1  AC-01, AC-02
  generation.test.ts           R1  AC-03, AC-04
  review.test.ts               R2  AC-05, AC-06, AC-07
  owner-approval.test.ts       R2  AC-08
  revision-cap.test.ts         R3  AC-09
  owner-rejection.test.ts      R3  AC-10
  invalid-transitions.test.ts  R3  AC-11, AC-12, immutability
```

Each test file belongs to exactly one TDD round, because R2 and R3 are done by
different people. `fixtures.ts` is created in R1 and shared by every round.

Naming: files are kebab-case. There is one `describe("AC-xx …")` per
criterion, and each `it` names the behaviour, for example
`it("moves in_review → revising and increments revisionRound")`. The AC ID
makes `vitest run -t AC-09` work.

## 7. Decisions on the open questions

| Question                       | Decision                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Throw or `Result`?             | Throw typed errors (§3)                                                                                            |
| Cap flag                       | Stored `reachedCap: boolean` (§2)                                                                                  |
| Owner approval after a cap hit | Allowed (AC-08 applies to any `awaiting_human` workflow)                                                           |
| API shape                      | One `transition(workflow, event)` over a union of events, plus `createWorkflow`                                    |
| Event names and payloads       | Named by actor, payloads as in §4                                                                                  |
| Blank Owner reason?            | Refused with `ValidationError` (AC-12)                                                                             |
| Feedback storage               | `reviewFeedback: readonly string[]`; the result keeps only the latest (AC-07)                                      |
| Immutability                   | `readonly` types and `Object.freeze` on returned values; tests use deep-equal snapshots                            |
| `id` and timestamps            | Not now: no AC needs them; infra can add them later without breaking changes                                       |
| Coverage target                | 100% of lines and branches in `src/domain/workflow/`, checked with `npm run test:coverage`; not enforced in config |
| Smoke test                     | Deleted in R1                                                                                                      |

**Out of scope:** validating the creation input. AC-02 checks only
`maxRevisions`. A blank description, an empty criteria list or a blank
criterion is accepted and stored as given. If it's needed, it can be added
later as a new AC.

## Verification

- After each round:
  - `npm test`, `npm run typecheck` and `npm run lint` are green.
  - Grep for `from "(next|react|node:)` in `src/domain/` returns nothing.
- After R3: `npm run test:coverage` shows 100% for `src/domain/workflow/`.
