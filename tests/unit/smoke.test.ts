import { describe, expect, it } from "vitest";

// Verifies the test runner and the "@/" path alias resolve correctly.
// Delete once real feature tests exist.
describe("test infrastructure", () => {
  it("resolves the @/ alias", async () => {
    const mod = await import("@/app/page");
    expect(typeof mod.default).toBe("function");
  });
});
