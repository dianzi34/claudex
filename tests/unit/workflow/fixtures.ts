import type { CreateWorkflowInput } from "@/domain/workflow";

/** A valid creation input with no revision cap (so the default applies). */
export function validInput(
  overrides: Partial<CreateWorkflowInput> = {},
): CreateWorkflowInput {
  return {
    description: "Write a haiku about state machines",
    acceptanceCriteria: ["Has three lines", "Follows the 5-7-5 pattern"],
    ...overrides,
  };
}
