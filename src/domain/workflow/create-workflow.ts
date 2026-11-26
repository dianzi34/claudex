import { ValidationError } from "@/domain/workflow/errors";
import type { CreateWorkflowInput, Workflow } from "@/domain/workflow/types";

export const DEFAULT_MAX_REVISIONS = 3;

export function createWorkflow(input: CreateWorkflowInput): Workflow {
  const maxRevisions = input.maxRevisions ?? DEFAULT_MAX_REVISIONS;
  if (!Number.isInteger(maxRevisions) || maxRevisions <= 0) {
    throw new ValidationError(
      "maxRevisions",
      `maxRevisions must be a positive integer, got ${maxRevisions}`,
    );
  }

  return Object.freeze({
    state: "pending",
    description: input.description,
    acceptanceCriteria: Object.freeze([...input.acceptanceCriteria]),
    maxRevisions,
    revisionRound: 0,
    reachedCap: false,
    latestResult: null,
    reviewFeedback: Object.freeze([]),
    rejectionReason: null,
  });
}
