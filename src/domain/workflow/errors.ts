import type { WorkflowEventType, WorkflowState } from "@/domain/workflow/types";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class InvalidTransitionError extends WorkflowError {
  readonly state: WorkflowState;
  readonly eventType: WorkflowEventType;

  constructor(state: WorkflowState, eventType: WorkflowEventType) {
    super(`Event ${eventType} is not allowed in state ${state}`);
    this.name = "InvalidTransitionError";
    this.state = state;
    this.eventType = eventType;
  }
}

export class ValidationError extends WorkflowError {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}
