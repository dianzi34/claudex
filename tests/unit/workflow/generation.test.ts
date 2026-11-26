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
