import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowState,
} from "@/domain/workflow/types";

type Handler = (workflow: Workflow, event: WorkflowEvent) => Workflow;

const TRANSITIONS: Record<
  WorkflowState,
  Partial<Record<WorkflowEventType, Handler>>
> = {
  pending: {
    START_GENERATION: (workflow) => ({ ...workflow, state: "generating" }),
  },
  generating: {
    SUBMIT_RESULT: (workflow, event) => ({
      ...workflow,
      state: "in_review",
      latestResult: (event as Extract<WorkflowEvent, { type: "SUBMIT_RESULT" }>)
        .result,
    }),
  },
  in_review: {},
  revising: {},
  awaiting_human: {},
  completed: {},
  rejected: {},
};

export function transition(workflow: Workflow, event: WorkflowEvent): Workflow {
  const handler = TRANSITIONS[workflow.state][event.type];
  if (!handler) {
    // Replaced by InvalidTransitionError in AC-11.
    throw new Error(
      `Event ${event.type} is not allowed in state ${workflow.state}`,
    );
  }
  return Object.freeze(handler(workflow, event));
}
