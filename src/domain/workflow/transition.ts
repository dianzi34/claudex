import type {
  Workflow,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowState,
} from "@/domain/workflow/types";

/** The event variant whose `type` is `T`, e.g. `{ type: "SUBMIT_RESULT"; result }`. */
type EventOf<T extends WorkflowEventType> = Extract<WorkflowEvent, { type: T }>;

/** A handler receives only the event variant it is registered for. */
type Handler<T extends WorkflowEventType> = (
  workflow: Workflow,
  event: EventOf<T>,
) => Workflow;

/** The events a state accepts, each keyed by its own event type. */
type StateHandlers = { readonly [T in WorkflowEventType]?: Handler<T> };

/** First result (from generating) and revised result (from revising) alike. */
const submitResult: Handler<"SUBMIT_RESULT"> = (workflow, event) => ({
  ...workflow,
  state: "in_review",
  latestResult: event.result,
});

const TRANSITIONS: Record<WorkflowState, StateHandlers> = {
  pending: {
    START_GENERATION: (workflow) => ({ ...workflow, state: "generating" }),
  },
  generating: {
    SUBMIT_RESULT: submitResult,
  },
  in_review: {
    REVIEW_APPROVE: (workflow) => ({ ...workflow, state: "awaiting_human" }),
    REVIEW_REJECT: (workflow, event) => {
      const reviewFeedback = Object.freeze([
        ...workflow.reviewFeedback,
        event.feedback,
      ]);
      if (workflow.revisionRound < workflow.maxRevisions) {
        return {
          ...workflow,
          state: "revising",
          revisionRound: workflow.revisionRound + 1,
          reviewFeedback,
        };
      }
      // Rejection N+1: no more revisions, hand the task to the Owner.
      return {
        ...workflow,
        state: "awaiting_human",
        reachedCap: true,
        reviewFeedback,
      };
    },
  },
  revising: {
    SUBMIT_RESULT: submitResult,
  },
  awaiting_human: {
    OWNER_APPROVE: (workflow) => ({ ...workflow, state: "completed" }),
    OWNER_REJECT: (workflow, event) => ({
      ...workflow,
      state: "rejected",
      rejectionReason: event.reason,
    }),
  },
  completed: {},
  rejected: {},
};

/**
 * Generic over the event type so TypeScript ties the looked-up handler to the
 * same event variant it is called with (no cast needed).
 */
function apply<T extends WorkflowEventType>(
  workflow: Workflow,
  event: EventOf<T>,
): Workflow {
  const handler: Handler<T> | undefined =
    TRANSITIONS[workflow.state][event.type];
  if (!handler) {
    // Replaced by InvalidTransitionError in AC-11.
    throw new Error(
      `Event ${event.type} is not allowed in state ${workflow.state}`,
    );
  }
  return Object.freeze(handler(workflow, event));
}

export function transition(workflow: Workflow, event: WorkflowEvent): Workflow {
  return apply(workflow, event);
}
