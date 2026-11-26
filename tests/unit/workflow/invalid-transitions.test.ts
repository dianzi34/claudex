import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  isTerminal,
  transition,
  ValidationError,
} from "@/domain/workflow";
import type {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowState,
} from "@/domain/workflow";
import { inReviewAtCap, workflowIn } from "./fixtures";

const STATES: readonly WorkflowState[] = [
  "pending",
  "generating",
  "in_review",
  "revising",
  "awaiting_human",
  "completed",
  "rejected",
];

/** One event of each type, each with a valid (non-blank) payload. */
const EVENTS: Readonly<Record<WorkflowEventType, WorkflowEvent>> = {
  START_GENERATION: { type: "START_GENERATION" },
  SUBMIT_RESULT: { type: "SUBMIT_RESULT", result: "Some result" },
  REVIEW_APPROVE: { type: "REVIEW_APPROVE" },
  REVIEW_REJECT: { type: "REVIEW_REJECT", feedback: "Some feedback" },
  OWNER_APPROVE: { type: "OWNER_APPROVE" },
  OWNER_REJECT: { type: "OWNER_REJECT", reason: "Some reason" },
};
const EVENT_TYPES = Object.keys(EVENTS) as WorkflowEventType[];

/** The 7 distinct (state, event) pairs allowed by plan §1. */
const ALLOWED: ReadonlyArray<readonly [WorkflowState, WorkflowEventType]> = [
  ["pending", "START_GENERATION"],
  ["generating", "SUBMIT_RESULT"],
  ["revising", "SUBMIT_RESULT"],
  ["in_review", "REVIEW_APPROVE"],
  ["in_review", "REVIEW_REJECT"],
  ["awaiting_human", "OWNER_APPROVE"],
  ["awaiting_human", "OWNER_REJECT"],
];
const isAllowed = (state: WorkflowState, eventType: WorkflowEventType) =>
  ALLOWED.some(([s, e]) => s === state && e === eventType);

const NOT_ALLOWED = STATES.flatMap((state) =>
  EVENT_TYPES.filter((eventType) => !isAllowed(state, eventType)).map(
    (eventType) => [state, eventType] as const,
  ),
);

/** Calls `fn` and returns what it threw; fails the test if it didn't throw. */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  expect.fail("expected the call to throw");
}

describe("AC-11 events not allowed in a state are refused", () => {
  it("AC-11 covers 35 disallowed (state, event) pairs", () => {
    expect(STATES.length * EVENT_TYPES.length).toBe(42);
    expect(NOT_ALLOWED).toHaveLength(35);
  });

  it.each(NOT_ALLOWED)(
    "AC-11 %s + %s throws InvalidTransitionError and leaves the workflow unchanged",
    (state, eventType) => {
      const workflow = workflowIn(state);
      const before = structuredClone(workflow);

      const error = thrownBy(() => transition(workflow, EVENTS[eventType]));

      expect(InvalidTransitionError).toBeTypeOf("function");
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect(error).toMatchObject({ state, eventType });
      expect(workflow).toEqual(before);
    },
  );

  it("AC-11 checks the state before the payload: pending + blank REVIEW_REJECT is an InvalidTransitionError", () => {
    const workflow = workflowIn("pending");
    const before = structuredClone(workflow);

    const error = thrownBy(() =>
      transition(workflow, { type: "REVIEW_REJECT", feedback: "" }),
    );

    expect(InvalidTransitionError).toBeTypeOf("function");
    expect(error).toBeInstanceOf(InvalidTransitionError);
    expect(error).not.toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      state: "pending",
      eventType: "REVIEW_REJECT",
    });
    expect(workflow).toEqual(before);
  });

  it.each(STATES)(
    "AC-11 isTerminal(%s) is true only for completed and rejected",
    (state) => {
      expect(isTerminal).toBeTypeOf("function");
      expect(isTerminal(state)).toBe(
        state === "completed" || state === "rejected",
      );
    },
  );
});

describe("AC-12 blank feedback or reason is refused", () => {
  const BLANKS = ["", "   ", "\n\t"];

  it.each(BLANKS)(
    "AC-12 in_review + REVIEW_REJECT with blank feedback %j throws ValidationError and leaves the workflow unchanged",
    (feedback) => {
      const workflow = workflowIn("in_review");
      const before = structuredClone(workflow);

      const error = thrownBy(() =>
        transition(workflow, { type: "REVIEW_REJECT", feedback }),
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ field: "feedback" });
      expect(workflow).toEqual(before);
    },
  );

  it.each(BLANKS)(
    "AC-12 at the cap, REVIEW_REJECT with blank feedback %j throws ValidationError and does not set reachedCap",
    (feedback) => {
      const workflow = inReviewAtCap(3);
      const before = structuredClone(workflow);

      const error = thrownBy(() =>
        transition(workflow, { type: "REVIEW_REJECT", feedback }),
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ field: "feedback" });
      expect(workflow.reachedCap).toBe(false);
      expect(workflow).toEqual(before);
    },
  );

  it.each(BLANKS)(
    "AC-12 awaiting_human + OWNER_REJECT with blank reason %j throws ValidationError and leaves the workflow unchanged",
    (reason) => {
      const workflow = workflowIn("awaiting_human");
      const before = structuredClone(workflow);

      const error = thrownBy(() =>
        transition(workflow, { type: "OWNER_REJECT", reason }),
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ field: "reason" });
      expect(workflow).toEqual(before);
    },
  );

  it("AC-12 accepts feedback with surrounding spaces and stores it exactly as given", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "  Tighten line two  ",
    });

    expect(next.state).toBe("revising");
    expect(next.reviewFeedback.at(-1)).toBe("  Tighten line two  ");
  });

  it("AC-12 accepts a reason with surrounding spaces and stores it exactly as given", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, {
      type: "OWNER_REJECT",
      reason: "\tOff topic \n",
    });

    expect(next.state).toBe("rejected");
    expect(next.rejectionReason).toBe("\tOff topic \n");
  });
});
