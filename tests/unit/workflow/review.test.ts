import { describe, expect, it } from "vitest";
import { transition } from "@/domain/workflow";
import { workflowIn } from "./fixtures";

describe("AC-05 reviewer approves the result", () => {
  it("AC-05 moves in_review to awaiting_human", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_APPROVE" });

    expect(next.state).toBe("awaiting_human");
  });

  it("AC-05 leaves reachedCap false", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_APPROVE" });

    expect(next.reachedCap).toBe(false);
  });

  it("AC-05 leaves every other field unchanged", () => {
    const workflow = workflowIn("in_review", { maxRevisions: 5 });

    const next = transition(workflow, { type: "REVIEW_APPROVE" });

    expect(next).toEqual({ ...workflow, state: "awaiting_human" });
    expect(next.revisionRound).toBe(0);
    expect(next.reviewFeedback).toEqual([]);
    expect(next.latestResult).toBe(workflow.latestResult);
  });

  it("AC-05 does not mutate the input workflow", () => {
    const workflow = workflowIn("in_review");
    const before = structuredClone(workflow);

    transition(workflow, { type: "REVIEW_APPROVE" });

    expect(workflow).toEqual(before);
    expect(workflow.state).toBe("in_review");
  });

  it("AC-05 returns a new frozen workflow", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_APPROVE" });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});
