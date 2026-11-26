import { expect } from "vitest";
import { createWorkflow, transition } from "@/domain/workflow";
import type {
  CreateWorkflowInput,
  Workflow,
  WorkflowState,
} from "@/domain/workflow";

/** A valid creation input with no revision cap (so the default applies). */
export function validInput(
  overrides: Partial<CreateWorkflowInput> = {},
): CreateWorkflowInput {
  return {
    description: "Write a haiku about state machines",
    acceptanceCriteria: ["Has three lines", "Follows the 5-7-5 pattern"],
    ...overrides,
  };
}

/**
 * Reaches `state` by replaying real events from `createWorkflow`, so tests
 * never see a hand-built (fake) workflow. More states are added as later
 * rounds need them.
 */
export function workflowIn(
  state: WorkflowState,
  overrides: Partial<CreateWorkflowInput> = {},
): Workflow {
  const pending = createWorkflow(validInput(overrides));
  switch (state) {
    case "pending":
      return pending;
    case "generating":
      return transition(pending, { type: "START_GENERATION" });
    case "in_review":
      return transition(transition(pending, { type: "START_GENERATION" }), {
        type: "SUBMIT_RESULT",
        result: "First draft",
      });
    case "revising":
      return transition(
        transition(transition(pending, { type: "START_GENERATION" }), {
          type: "SUBMIT_RESULT",
          result: "First draft",
        }),
        { type: "REVIEW_REJECT", feedback: "Needs another pass" },
      );
    case "awaiting_human":
      return transition(
        transition(transition(pending, { type: "START_GENERATION" }), {
          type: "SUBMIT_RESULT",
          result: "First draft",
        }),
        { type: "REVIEW_APPROVE" },
      );
    default:
      throw new Error(`workflowIn: state "${state}" is not supported yet`);
  }
}

/** Reviewer rejects, then the Worker submits a revision: in_review → in_review. */
function rejectAndRevise(workflow: Workflow, n: number): Workflow {
  const revising = transition(workflow, {
    type: "REVIEW_REJECT",
    feedback: `Feedback ${n}`,
  });
  expect(revising.state).toBe("revising");
  expect(revising.revisionRound).toBe(n);
  return transition(revising, {
    type: "SUBMIT_RESULT",
    result: `Revision ${n}`,
  });
}

/**
 * An in_review workflow whose revisionRound equals maxRevisions, reached by
 * replaying rejection n → "Feedback n" and revision n → "Revision n".
 */
export function inReviewAtCap(maxRevisions: number): Workflow {
  let workflow = workflowIn("in_review", { maxRevisions });
  for (let n = 1; n <= maxRevisions; n++) {
    workflow = rejectAndRevise(workflow, n);
  }
  expect(workflow.state).toBe("in_review");
  expect(workflow.revisionRound).toBe(maxRevisions);
  return workflow;
}

/**
 * An awaiting_human workflow that hit the cap: inReviewAtCap(maxRevisions)
 * plus the capped rejection "Feedback <maxRevisions + 1>".
 */
export function awaitingHumanAtCap(maxRevisions: number): Workflow {
  const capped = transition(inReviewAtCap(maxRevisions), {
    type: "REVIEW_REJECT",
    feedback: `Feedback ${maxRevisions + 1}`,
  });
  expect(capped.state).toBe("awaiting_human");
  expect(capped.reachedCap).toBe(true);
  return capped;
}
