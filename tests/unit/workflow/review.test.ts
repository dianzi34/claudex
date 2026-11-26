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

describe("AC-06 reviewer rejects below the cap", () => {
  const feedback = "Line 2 has 8 syllables, needs 7";

  it("AC-06 moves in_review to revising with the default cap", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(next.state).toBe("revising");
  });

  it("AC-06 increments revisionRound from 0 to 1", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(workflow.revisionRound).toBe(0);
    expect(next.revisionRound).toBe(1);
  });

  it("AC-06 appends the feedback to reviewFeedback exactly as given", () => {
    const workflow = workflowIn("in_review");
    const untrimmed = "  Too long  ";

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: untrimmed,
    });

    expect(next.reviewFeedback).toEqual([untrimmed]);
  });

  it("AC-06 moves to revising at round max - 1 (maxRevisions 1, round 0)", () => {
    const workflow = workflowIn("in_review", { maxRevisions: 1 });

    const next = transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(next.state).toBe("revising");
    expect(next.revisionRound).toBe(1);
    expect(next.reachedCap).toBe(false);
    expect(next.reviewFeedback).toEqual([feedback]);
  });

  it("AC-06 leaves every other field unchanged", () => {
    const workflow = workflowIn("in_review", { maxRevisions: 5 });

    const next = transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(next).toEqual({
      ...workflow,
      state: "revising",
      revisionRound: 1,
      reviewFeedback: [feedback],
    });
    expect(next.reachedCap).toBe(false);
    expect(next.maxRevisions).toBe(5);
    expect(next.latestResult).toBe(workflow.latestResult);
  });

  it("AC-06 does not mutate the input workflow", () => {
    const workflow = workflowIn("in_review");
    const before = structuredClone(workflow);

    transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(workflow).toEqual(before);
    expect(workflow.state).toBe("in_review");
    expect(workflow.reviewFeedback).toEqual([]);
  });

  it("AC-06 returns a new frozen workflow", () => {
    const workflow = workflowIn("in_review");

    const next = transition(workflow, { type: "REVIEW_REJECT", feedback });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});
