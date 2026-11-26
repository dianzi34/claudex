import { describe, expect, it } from "vitest";
import { transition } from "@/domain/workflow";
import { workflowIn } from "./fixtures";

describe("AC-08 owner approves the workflow", () => {
  it("AC-08 moves awaiting_human to completed", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, { type: "OWNER_APPROVE" });

    expect(next.state).toBe("completed");
  });

  it("AC-08 leaves reachedCap false after a reviewer approval", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, { type: "OWNER_APPROVE" });

    expect(workflow.reachedCap).toBe(false);
    expect(next.reachedCap).toBe(false);
  });

  it("AC-08 leaves every other field unchanged", () => {
    const workflow = workflowIn("awaiting_human", { maxRevisions: 5 });

    const next = transition(workflow, { type: "OWNER_APPROVE" });

    expect(next).toEqual({ ...workflow, state: "completed" });
    expect(next.maxRevisions).toBe(5);
    expect(next.revisionRound).toBe(0);
    expect(next.latestResult).toBe("First draft");
    expect(next.reviewFeedback).toEqual([]);
    expect(next.rejectionReason).toBeNull();
  });

  it("AC-08 does not mutate the input workflow", () => {
    const workflow = workflowIn("awaiting_human");
    const before = structuredClone(workflow);

    transition(workflow, { type: "OWNER_APPROVE" });

    expect(workflow).toEqual(before);
    expect(workflow.state).toBe("awaiting_human");
  });

  it("AC-08 returns a new frozen workflow", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, { type: "OWNER_APPROVE" });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});
