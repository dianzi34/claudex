import { describe, expect, it } from "vitest";
import { transition } from "@/domain/workflow";
import type { Workflow } from "@/domain/workflow";
import { workflowIn } from "./fixtures";

/** Reviewer rejects, then the Worker submits a revision: in_review → in_review. */
function rejectAndRevise(workflow: Workflow, n: number): Workflow {
  const revising = transition(workflow, {
    type: "REVIEW_REJECT",
    feedback: `Feedback ${n}`,
  });
  expect(revising.state).toBe("revising");
  expect(revising.revisionRound).toBe(n);
  return transition(revising, {
    type: "SUBMIT_RESULT",
    result: `Revision ${n}`,
  });
}

/** An in_review workflow whose revisionRound equals maxRevisions. */
function inReviewAtCap(maxRevisions: number): Workflow {
  let workflow = workflowIn("in_review", { maxRevisions });
  for (let n = 1; n <= maxRevisions; n++) {
    workflow = rejectAndRevise(workflow, n);
  }
  expect(workflow.state).toBe("in_review");
  expect(workflow.revisionRound).toBe(maxRevisions);
  return workflow;
}

describe("AC-09 reviewer rejects at the revision cap", () => {
  it("AC-09 rejections 1–3 go to revising with revisionRound 1 → 2 → 3 (maxRevisions 3)", () => {
    let workflow = workflowIn("in_review", { maxRevisions: 3 });

    for (let n = 1; n <= 3; n++) {
      const revising = transition(workflow, {
        type: "REVIEW_REJECT",
        feedback: `Feedback ${n}`,
      });
      expect(revising.state).toBe("revising");
      expect(revising.revisionRound).toBe(n);
      expect(revising.reachedCap).toBe(false);

      workflow = transition(revising, {
        type: "SUBMIT_RESULT",
        result: `Revision ${n}`,
      });
      expect(workflow.state).toBe("in_review");
      expect(workflow.revisionRound).toBe(n);
    }
  });

  it("AC-09 rejection 4 at round 3 moves to awaiting_human, not revising", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next.state).toBe("awaiting_human");
  });

  it("AC-09 leaves revisionRound at 3 on rejection 4", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next.revisionRound).toBe(3);
  });

  it("AC-09 sets reachedCap to true on rejection 4", () => {
    const workflow = inReviewAtCap(3);
    expect(workflow.reachedCap).toBe(false);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next.reachedCap).toBe(true);
  });

  it("AC-09 still appends the 4th feedback, oldest first", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next.reviewFeedback).toEqual([
      "Feedback 1",
      "Feedback 2",
      "Feedback 3",
      "Feedback 4",
    ]);
  });

  it("AC-09 leaves every other field unchanged on the capped rejection", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next).toEqual({
      ...workflow,
      state: "awaiting_human",
      reachedCap: true,
      reviewFeedback: [...workflow.reviewFeedback, "Feedback 4"],
    });
    expect(next.latestResult).toBe("Revision 3");
    expect(next.maxRevisions).toBe(3);
  });

  it("AC-09 with maxRevisions 1: first rejection → revising, second → awaiting_human", () => {
    const first = transition(workflowIn("in_review", { maxRevisions: 1 }), {
      type: "REVIEW_REJECT",
      feedback: "Feedback 1",
    });
    expect(first.state).toBe("revising");
    expect(first.revisionRound).toBe(1);
    expect(first.reachedCap).toBe(false);

    const back = transition(first, {
      type: "SUBMIT_RESULT",
      result: "Revision 1",
    });
    const second = transition(back, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 2",
    });

    expect(second.state).toBe("awaiting_human");
    expect(second.revisionRound).toBe(1);
    expect(second.reachedCap).toBe(true);
    expect(second.reviewFeedback).toEqual(["Feedback 1", "Feedback 2"]);
  });

  it("AC-09 a reviewer approval at round === max lands in awaiting_human with reachedCap false", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, { type: "REVIEW_APPROVE" });

    expect(next.state).toBe("awaiting_human");
    expect(next.revisionRound).toBe(3);
    expect(next.reachedCap).toBe(false);
    expect(next.reviewFeedback).toHaveLength(3);
  });

  it("AC-09 does not mutate the input workflow", () => {
    const workflow = inReviewAtCap(3);
    const before = structuredClone(workflow);

    transition(workflow, { type: "REVIEW_REJECT", feedback: "Feedback 4" });

    expect(workflow).toEqual(before);
    expect(workflow.state).toBe("in_review");
    expect(workflow.reachedCap).toBe(false);
    expect(workflow.reviewFeedback).toHaveLength(3);
  });

  it("AC-09 returns a new frozen workflow", () => {
    const workflow = inReviewAtCap(3);

    const next = transition(workflow, {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });

    expect(next).not.toBe(workflow);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(next.reviewFeedback)).toBe(true);
  });
});

describe("AC-08 owner approves after a cap hit", () => {
  it("AC-08 moves a capped awaiting_human workflow to completed and keeps reachedCap true", () => {
    const capped = transition(inReviewAtCap(3), {
      type: "REVIEW_REJECT",
      feedback: "Feedback 4",
    });
    expect(capped.state).toBe("awaiting_human");
    expect(capped.reachedCap).toBe(true);

    const next = transition(capped, { type: "OWNER_APPROVE" });

    expect(next).toEqual({ ...capped, state: "completed" });
    expect(next.reachedCap).toBe(true);
    expect(next.revisionRound).toBe(3);
    expect(next.reviewFeedback).toHaveLength(4);
  });
});
