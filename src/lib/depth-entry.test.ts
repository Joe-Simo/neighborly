import { expect, test } from "bun:test";
import { getDepthEntryFrame, finalReady } from "./depth-entry";

test("handoff remains centered until the painted replacement is fully visible", () => {
  expect(getDepthEntryFrame(0)).toEqual({ handoff: 0, garden: 0, arrived: false });
  expect(getDepthEntryFrame(.125)).toEqual({ handoff: .5, garden: 0, arrived: false });
  expect(getDepthEntryFrame(.25)).toEqual({ handoff: 1, garden: 0, arrived: false });
  expect(getDepthEntryFrame(.4).garden).toBeCloseTo(.5);
  expect(getDepthEntryFrame(.6)).toEqual({ handoff: 1, garden: 1, arrived: true });
});
test("reduced motion skips the handoff travel", () => {
  expect(getDepthEntryFrame(0, true)).toEqual({ handoff: 1, garden: 1, arrived: true });
});


test("final copy matches the normal and reduced-motion panorama thresholds", () => {
  expect(finalReady(.9949)).toBe(false);
  expect(finalReady(.995)).toBe(true);
  expect(finalReady(.9749, true)).toBe(false);
  expect(finalReady(.975, true)).toBe(true);
  expect(finalReady(1, true)).toBe(true);
  expect(finalReady(Number.NaN)).toBe(false);
  expect(finalReady(Infinity, true)).toBe(false);
  expect(finalReady(-Infinity)).toBe(false);
});

test("reduced motion does not reveal the courtyard before its arrival", () => { expect(getDepthEntryFrame(-.1, true).handoff).toBe(0); expect(getDepthEntryFrame(0, true).handoff).toBe(1); });

test("invalid travel keeps the entry safely hidden", () => { for (const travel of [NaN, Infinity, -Infinity]) for (const reduced of [false, true]) expect(getDepthEntryFrame(travel, reduced)).toEqual({ handoff: 0, garden: 0, arrived: false }); });
