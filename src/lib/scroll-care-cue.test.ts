import { expect, test } from "bun:test";
import { getScrollCareCue, type ScrollCareCompletion } from "./scroll-care-cue";

test("initial or restored scroll is silent even when all acts are complete", () => {
  expect(getScrollCareCue(undefined, [true, true, true])).toBeNull();
  expect(getScrollCareCue(undefined, [false, false, false])).toBeNull();
});

test("forward completion accents only the latest crossed act and ignores rerenders", () => {
  expect(getScrollCareCue([false, false, false], [true, false, false])).toBe(0);
  expect(getScrollCareCue([true, false, false], [true, true, false])).toBe(1);
  expect(getScrollCareCue([false, false, false], [true, true, true])).toBe(2);
  expect(getScrollCareCue([true, true, true], [true, true, true])).toBeNull();
});

test("reverse travel is silent and makes a later forward completion eligible", () => {
  const completed: ScrollCareCompletion = [true, true, true];
  const reversed: ScrollCareCompletion = [true, false, false];
  expect(getScrollCareCue(completed, reversed)).toBeNull();
  expect(getScrollCareCue(reversed, [true, true, false])).toBe(1);
  expect(getScrollCareCue([true, true, false], completed)).toBe(2);
});
