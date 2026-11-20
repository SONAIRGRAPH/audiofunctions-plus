import { describe, expect, it } from "vitest";
import { nextFunctionName } from "./graphObjectOperations";

const named = (...names) => names.map((functionName, i) => ({ id: `f${i + 1}`, functionName }));

describe("nextFunctionName", () => {
  it("starts at Function 1", () => {
    expect(nextFunctionName([])).toBe("Function 1");
    expect(nextFunctionName(undefined)).toBe("Function 1");
  });

  it("continues after the existing names", () => {
    expect(nextFunctionName(named("Function 1", "Function 2"))).toBe("Function 3");
  });

  it("reuses the number of a deleted function instead of repeating a name", () => {
    // Function 1 of two was deleted: counting would give a second "Function 2"
    expect(nextFunctionName(named("Function 2"))).toBe("Function 1");
  });

  it("ignores custom names", () => {
    expect(nextFunctionName(named("Speed", "Function 1"))).toBe("Function 2");
  });
});
