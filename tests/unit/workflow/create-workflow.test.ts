import { describe, expect, it } from "vitest";
import { createWorkflow, DEFAULT_MAX_REVISIONS } from "@/domain/workflow";
import { validInput } from "./fixtures";

describe("AC-01 create a workflow", () => {
  it("AC-01 starts in pending with default fields when no cap is given", () => {
    const workflow = createWorkflow(validInput());

    expect(workflow.state).toBe("pending");
    expect(workflow.revisionRound).toBe(0);
    expect(workflow.maxRevisions).toBe(DEFAULT_MAX_REVISIONS);
    expect(workflow.reachedCap).toBe(false);
    expect(workflow.latestResult).toBeNull();
    expect(workflow.reviewFeedback).toEqual([]);
    expect(workflow.rejectionReason).toBeNull();
  });

  it("AC-01 uses a default cap of 3", () => {
    expect(DEFAULT_MAX_REVISIONS).toBe(3);
    expect(createWorkflow(validInput()).maxRevisions).toBe(3);
  });

  it("AC-01 keeps the description and acceptance criteria exactly as given", () => {
    const input = validInput({
      description: "  Summarise the report  ",
      acceptanceCriteria: ["Under 200 words", " Mentions the budget "],
    });

    const workflow = createWorkflow(input);

    expect(workflow.description).toBe("  Summarise the report  ");
    expect(workflow.acceptanceCriteria).toEqual([
      "Under 200 words",
      " Mentions the budget ",
    ]);
  });

  it("AC-01 keeps a valid custom cap", () => {
    const workflow = createWorkflow(validInput({ maxRevisions: 5 }));

    expect(workflow.maxRevisions).toBe(5);
  });

  it("AC-01 returns a frozen workflow with frozen arrays", () => {
    const workflow = createWorkflow(validInput());

    expect(Object.isFrozen(workflow)).toBe(true);
    expect(Object.isFrozen(workflow.acceptanceCriteria)).toBe(true);
    expect(Object.isFrozen(workflow.reviewFeedback)).toBe(true);
  });
});
