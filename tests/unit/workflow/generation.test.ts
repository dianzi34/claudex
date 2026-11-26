import { describe, expect, it } from "vitest";
import { transition } from "@/domain/workflow";
import { workflowIn } from "./fixtures";

describe("AC-03 start generation", () => {
  it("AC-03 moves pending to generating", () => {
    const workflow = workflowIn("pending");

    const next = transition(workflow, { type: "START_GENERATION" });

    expect(next.state).toBe("generating");
  });

  it("AC-03 leaves every other field unchanged", () => {
    const workflow = workflowIn("pending", { maxRevisions: 5 });

    const next = transition(workflow, { type: "START_GENERATION" });

    expect(next).toEqual({ ...workflow, state: "generating" });
    expect(next.revisionRound).toBe(0);
    expect(next.maxRevisions).toBe(5);
  });

  it("AC-03 does not mutate the input workflow", () => {
    const workflow = workflowIn("pending");
    const before = structuredClone(workflow);

    transition(workflow, { type: "START_GENERATION" });

    expect(workflow).toEqual(before);
  });

  it("AC-03 returns a new frozen workflow", () => {
    const workflow = workflowIn("pending");

    const next = transition(workflow, { type: "START_GENERATION" });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});

describe("AC-04 worker submits the first result", () => {
  const result =
    "Pure functions flow\nState to state, no side effects\nThe loop always ends";

  it("AC-04 moves generating to in_review", () => {
    const workflow = workflowIn("generating");

    const next = transition(workflow, { type: "SUBMIT_RESULT", result });

    expect(next.state).toBe("in_review");
  });

  it("AC-04 stores the result as the latest result", () => {
    const workflow = workflowIn("generating");

    const next = transition(workflow, { type: "SUBMIT_RESULT", result });

    expect(next.latestResult).toBe(result);
  });

  it("AC-04 stores the result exactly as given, without trimming", () => {
    const workflow = workflowIn("generating");
    const padded = "  \n  draft with surrounding whitespace \t\n";

    const next = transition(workflow, {
      type: "SUBMIT_RESULT",
      result: padded,
    });

    expect(next.latestResult).toBe(padded);
  });

  it("AC-04 leaves revisionRound at 0 and every other field unchanged", () => {
    const workflow = workflowIn("generating", { maxRevisions: 5 });

    const next = transition(workflow, { type: "SUBMIT_RESULT", result });

    expect(next).toEqual({
      ...workflow,
      state: "in_review",
      latestResult: result,
    });
    expect(next.revisionRound).toBe(0);
    expect(next.maxRevisions).toBe(5);
    expect(next.reachedCap).toBe(false);
    expect(next.reviewFeedback).toEqual([]);
    expect(next.rejectionReason).toBeNull();
  });

  it("AC-04 does not mutate the input workflow", () => {
    const workflow = workflowIn("generating");
    const before = structuredClone(workflow);

    transition(workflow, { type: "SUBMIT_RESULT", result });

    expect(workflow).toEqual(before);
    expect(workflow.latestResult).toBeNull();
  });

  it("AC-04 returns a new frozen workflow", () => {
    const workflow = workflowIn("generating");

    const next = transition(workflow, { type: "SUBMIT_RESULT", result });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});
