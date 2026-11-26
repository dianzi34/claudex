# ClaudeX — Product Requirements

Status: draft for HW4. Owner: Xinyu Li. Reviewer: Bo Pang.

## 1. Goal

ClaudeX is a multi-agent workbench. A person describes a task and its
acceptance criteria; a **Worker** agent produces a result; a **Reviewer** agent
checks the result against the criteria and sends it back for revision if it
falls short. Revisions are capped so the loop always ends, and a human gives
the final approval.

The value is a predictable loop: every task ends in a known state, and a human
never has to watch agents argue forever.

## 2. Roles

| Role           | Kind  | Can do                                                                                       |
| -------------- | ----- | -------------------------------------------------------------------------------------------- |
| Owner          | Human | Create tasks, set acceptance criteria and the revision cap, give final approval or rejection |
| Collaborator   | Human | View tasks, results and review feedback; cannot approve or reject                            |
| Worker agent   | AI    | Produce a result for a task; produce a revised result from review feedback                   |
| Reviewer agent | AI    | Approve a result, or reject it with written feedback tied to the criteria                    |

## 3. Scope

### P0 (must have)

- Create a task with a description, acceptance criteria and a revision cap.
- Worker → Reviewer → (revise) loop driven by a workflow state machine.
- Revision cap: the loop stops and hands control to a human when the cap is hit.
- Human final approval or rejection.
- Invalid actions (for example approving a task that is still generating) are
  refused and leave the task unchanged.

### P1 (later)

- Full per-task history of every transition and every result version.
- Retry when the Worker fails to produce a result (provider error, timeout).
- Several collaborators seeing updates in real time.
- Human can send a task back for another revision instead of only approve / reject.

### Out of scope

- Real AI provider calls, persistence and UI for the HW4 feature. HW4 builds
  only the pure domain logic (see `docs/ARCHITECTURE.md`).
- Accounts, billing, deployment.

## 4. Workflow State Machine

This is the HW4 feature. It owns the life cycle of one task.

### 4.1 States

| State            | Meaning                                                 | Terminal |
| ---------------- | ------------------------------------------------------- | -------- |
| `pending`        | Task created, Worker has not started                    | no       |
| `generating`     | Worker is producing the first result                    | no       |
| `in_review`      | Reviewer is checking the latest result                  | no       |
| `revising`       | Reviewer rejected; Worker is producing a revised result | no       |
| `awaiting_human` | Waiting for the Owner's final decision                  | no       |
| `completed`      | Owner approved                                          | yes      |
| `rejected`       | Owner rejected                                          | yes      |

### 4.2 Revision round

`revisionRound` counts how many times the Reviewer has sent the task back. It
starts at 0. With `maxRevisions = N`, the Worker may revise at most N times;
the (N+1)-th Reviewer rejection does not start another revision and goes to
the Owner instead. Example with N = 3: rejections 1, 2 and 3 lead to
`revising`; rejection 4 leads to `awaiting_human`.

### 4.3 Acceptance criteria (final)

Each criterion is one testable behaviour. They are grouped into the three TDD
rounds. The design, API and test layout are in
`docs/plans/workflow-state-machine.md`.

**Round 1 — initialisation and generation**

- **AC-01** Given a task description and acceptance criteria, when a workflow
  is created without a revision cap, then it is in `pending`, `revisionRound`
  is 0 and `maxRevisions` is 3; when it is created with a valid cap (for
  example 5), then `maxRevisions` is that value.
- **AC-02** Given a revision cap that is not a positive integer (0, negative,
  or fractional), when a workflow is created, then creation fails with a
  validation error.
- **AC-03** Given a workflow in `pending`, when generation starts, then it
  moves to `generating`.
- **AC-04** Given a workflow in `generating`, when the Worker submits a result,
  then it moves to `in_review` and the result is stored as the latest result.

**Round 2 — review and human approval**

- **AC-05** Given a workflow in `in_review`, when the Reviewer approves, then
  it moves to `awaiting_human`.
- **AC-06** Given a workflow in `in_review` with `revisionRound` below
  `maxRevisions`, when the Reviewer rejects with feedback, then it moves to
  `revising`, `revisionRound` increases by 1 and the feedback is stored.
- **AC-07** Given a workflow in `revising`, when the Worker submits a revised
  result, then it moves to `in_review` and the revised result replaces the
  latest result.
- **AC-08** Given a workflow in `awaiting_human`, when the Owner approves, then
  it moves to `completed`.

**Round 3 — revision cap, errors and edge cases**

- **AC-09** Given a workflow in `in_review` with `revisionRound` equal to
  `maxRevisions`, when the Reviewer rejects, then it moves to `awaiting_human`
  (not `revising`), `revisionRound` does not change, the feedback is stored,
  and the workflow is marked as having reached the cap.
- **AC-10** Given a workflow in `awaiting_human`, when the Owner rejects with
  a reason, then it moves to `rejected` and the reason is stored.
- **AC-11** Given a workflow in any state, when an event that is not allowed
  in that state is applied (including any event in `completed` or `rejected`),
  then the transition fails with an invalid-transition error and the workflow
  is unchanged.
- **AC-12** Given a workflow in `in_review`, when the Reviewer rejects with
  empty or whitespace-only feedback, or given a workflow in `awaiting_human`,
  when the Owner rejects with an empty or whitespace-only reason, then the
  transition fails with a validation error and the workflow is unchanged.

### 4.4 Resolved questions

All of these were decided in `docs/plans/workflow-state-machine.md` §7.

- Error semantics: **throw typed errors** (`InvalidTransitionError`,
  `ValidationError`), not a result type.
- The cap mark (AC-09) is **its own stored field**, `reachedCap`. It can't be
  worked out from `revisionRound === maxRevisions`, because a Reviewer
  approval at that round also leads to `awaiting_human`.
- The Owner **can** approve a task that reached the cap. AC-08 applies to any
  `awaiting_human` workflow.
