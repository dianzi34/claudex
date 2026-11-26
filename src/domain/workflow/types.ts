export type WorkflowState =
  | "pending"
  | "generating"
  | "in_review"
  | "revising"
  | "awaiting_human"
  | "completed"
  | "rejected";

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
  maxRevisions?: number; // default DEFAULT_MAX_REVISIONS
}

export type WorkflowEvent =
  | { readonly type: "START_GENERATION" }
  | { readonly type: "SUBMIT_RESULT"; readonly result: string }
  | { readonly type: "REVIEW_APPROVE" }
  | { readonly type: "REVIEW_REJECT"; readonly feedback: string }
  | { readonly type: "OWNER_APPROVE" }
  | { readonly type: "OWNER_REJECT"; readonly reason: string };

export type WorkflowEventType = WorkflowEvent["type"];
