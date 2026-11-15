import { ConvexError } from "convex/values";
import { describe, expect, it } from "bun:test";
import { readFailure, stateWords } from "./failure";

describe("readFailure", () => {
  it("gives the backend's own sentence from a ConvexError", () => {
    expect(readFailure(new ConvexError("This is more than what is left."))).toBe("This is more than what is left.");
  });
  it("gives the sentence a development server sends", () => {
    expect(
      readFailure(new Error("[CONVEX M(treasury:recordPayment)] [Request ID: a1] Server Error\nUncaught Error: Choose today or an earlier day.\n    at handler")),
    ).toBe("Choose today or an earlier day.");
  });
  it("never shows a production server line", () => {
    expect(readFailure(new Error("[CONVEX M(treasury:recordPayment)] [Request ID: a1] Server Error"))).toBe(stateWords.notSaved);
    expect(readFailure("anything", "Not kept.")).toBe("Not kept.");
  });
});
