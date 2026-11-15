import { expect, test } from "bun:test";
import { stepChair } from "./chair-motion";

test("chair settling is equivalent across 60 and 120Hz", () => {
  const simulate = (fps: number) => {
    let current = 0;
    for (let frame = 0; frame < fps / 2; frame++) current = stepChair(current, 1, 1 / fps);
    return current;
  };
  expect(simulate(60)).toBeCloseTo(simulate(120), 12);
});

test("chair motion snaps near the target and honors reduced motion", () => {
  expect(stepChair(.9995, 1, 1 / 60)).toBe(1);
  expect(stepChair(.2, 1, 1 / 120, true)).toBe(1);
  expect(stepChair(.8, 0, 1 / 120, true)).toBe(0);
  expect(stepChair(0, 1, 10)).toBe(stepChair(0, 1, .05));
  expect(stepChair(0, 1, Number.NaN)).toBe(0);
});
