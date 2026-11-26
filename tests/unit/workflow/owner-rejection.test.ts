import { describe, expect, it } from "vitest";
import { transition } from "@/domain/workflow";
import { awaitingHumanAtCap, workflowIn } from "./fixtures";

describe("AC-10 owner rejects the workflow with a reason", () => {
  it("AC-10 moves awaiting_human to rejected", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, {
      type: "OWNER_REJECT",
      reason: "Not what I asked for",
    });

    expect(next.state).toBe("rejected");
  });

  it("AC-10 stores the reason as rejectionReason", () => {
    const workflow = workflowIn("awaiting_human");
    expect(workflow.rejectionReason).toBeNull();

    const next = transition(workflow, {
      type: "OWNER_REJECT",
      reason: "Not what I asked for",
    });

    expect(next.rejectionReason).toBe("Not what I asked for");
  });

  it("AC-10 stores the reason exactly as given, without trimming", () => {
    const reason = "  Off topic.\n  Please start over.  ";

    const next = transition(workflowIn("awaiting_human"), {
      type: "OWNER_REJECT",
      reason,
    });

    expect(next.rejectionReason).toBe(reason);
  });

  it("AC-10 leaves every other field unchanged", () => {
    const workflow = workflowIn("awaiting_human", { maxRevisions: 5 });

    const next = transition(workflow, {
      type: "OWNER_REJECT",
      reason: "Not what I asked for",
    });

    expect(next).toEqual({
      ...workflow,
      state: "rejected",
      rejectionReason: "Not what I asked for",
    });
    expect(next.maxRevisions).toBe(5);
    expect(next.revisionRound).toBe(0);
    expect(next.reachedCap).toBe(false);
    expect(next.latestResult).toBe("First draft");
    expect(next.reviewFeedback).toEqual([]);
  });

  it("AC-10 rejects a capped workflow and keeps reachedCap true", () => {
    const capped = awaitingHumanAtCap(1);

    const next = transition(capped, {
      type: "OWNER_REJECT",
      reason: "Still wrong after the last revision",
    });

    expect(next).toEqual({
      ...capped,
      state: "rejected",
      rejectionReason: "Still wrong after the last revision",
    });
    expect(next.reachedCap).toBe(true);
    expect(next.revisionRound).toBe(1);
    expect(next.latestResult).toBe("Revision 1");
    expect(next.reviewFeedback).toEqual(["Feedback 1", "Feedback 2"]);
  });

  it("AC-10 does not mutate the input workflow", () => {
    const workflow = workflowIn("awaiting_human");
    const before = structuredClone(workflow);

    transition(workflow, { type: "OWNER_REJECT", reason: "No" });

    expect(workflow).toEqual(before);
    expect(workflow.state).toBe("awaiting_human");
    expect(workflow.rejectionReason).toBeNull();
  });

  it("AC-10 does not mutate a capped input workflow", () => {
    const capped = awaitingHumanAtCap(1);
    const before = structuredClone(capped);

    transition(capped, { type: "OWNER_REJECT", reason: "No" });

    expect(capped).toEqual(before);
  });

  it("AC-10 returns a new frozen workflow", () => {
    const workflow = workflowIn("awaiting_human");

    const next = transition(workflow, { type: "OWNER_REJECT", reason: "No" });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});
