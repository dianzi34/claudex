import type { CreateWorkflowInput, Workflow } from "@/domain/workflow/types";

export const DEFAULT_MAX_REVISIONS = 3;

export function createWorkflow(input: CreateWorkflowInput): Workflow {
  return Object.freeze({
    state: "pending",
    description: input.description,
    acceptanceCriteria: Object.freeze([...input.acceptanceCriteria]),
    maxRevisions: input.maxRevisions ?? DEFAULT_MAX_REVISIONS,
    revisionRound: 0,
    reachedCap: false,
    latestResult: null,
    reviewFeedback: Object.freeze([]),
    rejectionReason: null,
  });
}
