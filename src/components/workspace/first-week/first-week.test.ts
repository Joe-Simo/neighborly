import { describe, expect, test } from "bun:test";
import { firstWeekSlips, isNewMember, NEW_FOR } from "./first-week-state";

describe("first week", () => {
  test("only a member who joined in the last two weeks", () => {
    expect(isNewMember(1000, 1000 + NEW_FOR - 1)).toBe(true);
    expect(isNewMember(1000, 1000 + NEW_FOR)).toBe(false);
    expect(isNewMember(undefined, 1000)).toBe(false);
  });
  test("leaders take a call, plan a visit and say yes; members get their own three", () => {
    expect(firstWeekSlips(true).map((slip) => slip.id)).toEqual(["call", "visit", "yes"]);
    expect(firstWeekSlips(false).map((slip) => slip.id)).toEqual(["yes", "mine", "away"]);
  });
});
