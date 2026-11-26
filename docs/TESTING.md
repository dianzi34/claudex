# ClaudeX — Testing Strategy

Applies to all domain code, starting with the workflow state machine
(`src/domain/workflow/`, PRD §4). Acceptance criteria (AC-01 … AC-12) are
defined in `docs/PRD.md` §4.3.

## 1. TDD cycle

Strict TDD, **one acceptance criterion per red → green → refactor cycle**.

1. **Red** — write the test(s) for one AC. Run them and confirm they fail for
   the expected reason (missing behaviour, not a typo or broken import).
   Commit the test file **on its own**, before any implementation.
2. **Green** — write the smallest implementation that makes the test pass.
   All existing tests must stay green. Commit.
3. **Refactor** (optional) — improve names, structure or duplication with no
   behaviour change; tests stay green. Commit separately.

Never squash, reorder or rewrite commits to manufacture the red → green
history. If a cycle went wrong, fix it forward with a new commit.

## 2. Commit messages

```
test(workflow): AC-xx red — <behaviour under test>
feat(workflow): AC-xx green — <what was implemented>
refactor(workflow): <what changed, no behaviour change>
```

Examples:

```
test(workflow): AC-03 red — start generation moves pending to generating
feat(workflow): AC-03 green — handle START_GENERATION in pending
refactor(workflow): extract transition table into its own module
```

No AI attribution trailers in commits (see `CLAUDE.md`).

## 3. Where tests live and how they are named

- Tests live under `tests/unit/`, in a folder that mirrors the source folder
  below `src/domain/`: `src/domain/workflow/` → `tests/unit/workflow/`.
- Inside that folder, test files are split by behaviour, not one test file
  per source file. Each file covers one group of ACs from a single TDD round.
  For the workflow (plan §6) the files are `create-workflow.test.ts`,
  `generation.test.ts`, `review.test.ts`, `owner-approval.test.ts`,
  `revision-cap.test.ts`, `owner-rejection.test.ts` and
  `invalid-transitions.test.ts`.
- Shared helpers (`validInput()`, `workflowIn(state, opts)`) live in
  `tests/unit/workflow/fixtures.ts`. It isn't a `*.test.ts` file, so Vitest
  doesn't run it as a test.
- Files end in `.test.ts` (Vitest only collects `tests/**/*.test.ts`;
  `.test.tsx` is not picked up).
- Import source through the alias and the public index only:
  `import { … } from "@/domain/workflow"`.
- Group tests by AC and start every test name with the AC id, so
  `npx vitest run -t "AC-06"` selects exactly that criterion:

```ts
describe("AC-06 reviewer rejects below the cap", () => {
  it("AC-06 moves in_review to revising", () => { … });
  it("AC-06 increments revisionRound by 1", () => { … });
  it("AC-06 stores the reviewer feedback", () => { … });
});
```

## 4. What to assert

- **Behaviour, not implementation.** Assert on the returned workflow value
  (state, `revisionRound`, latest result, feedback) or on the error — never
  on private helpers or the shape of the transition table.
- **Edge cases from the AC.** Boundaries are explicit tests, e.g.
  `revisionRound` one below vs. equal to `maxRevisions` (AC-06 / AC-09);
  cap values `0`, negative and fractional (AC-02); empty and whitespace-only
  feedback (AC-12); every event in `completed` and `rejected` (AC-11 — use
  `it.each` over state × event).
- **Errors.** Errors are thrown as typed errors (`InvalidTransitionError` /
  `ValidationError`, see plan §3). Assert the error class, for example
  `toThrow(InvalidTransitionError)`, not just "it failed".
- **Immutability (ARCHITECTURE D2).** A successful transition returns a new
  value and leaves its input untouched; a failed transition leaves the input
  exactly as it was. Snapshot the input with `structuredClone` before the
  call and compare afterwards:

```ts
const workflow = workflowIn("pending"); // from fixtures.ts
const before = structuredClone(workflow);
expect(() => transition(workflow, { type: "OWNER_APPROVE" })).toThrow(
  InvalidTransitionError,
);
expect(workflow).toEqual(before);
```

- **Determinism.** Domain tests use no timers, network, randomness or
  `Date.now()`; any time value is passed in as an argument.

## 5. Commands

```bash
npm test                                          # all tests once
npm run test:watch                                # watch mode while in a cycle
npx vitest run tests/unit/workflow/review.test.ts       # single file
npx vitest run -t "AC-06"                         # single AC / test by name
npm run test:coverage                             # v8 coverage (text + coverage/ html)
```

Before opening a PR: `npm run lint`, `npm run typecheck`,
`npm run format:check`, `npm test`.
