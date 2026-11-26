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
    default:
      throw new Error(`workflowIn: state "${state}" is not supported yet`);
  }
}
