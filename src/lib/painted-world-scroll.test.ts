import { expect, test } from "bun:test";
import { getPaintedScrollState } from "./painted-world-scroll";

test("scroll timeline preserves opening and holds the final gathering", () => {
  expect(getPaintedScrollState(0)).toMatchObject({ scene: "opening", interaction: 0, dissolve: 0 });
  expect(getPaintedScrollState(0.88)).toMatchObject({ scene: "complete", nextScene: null });
  expect(getPaintedScrollState(1).captionScene).toBe("complete");
  expect(getPaintedScrollState(Number.NaN).scene).toBe("opening");
});

test("each transition completes its prop action before dissolving", () => {
  for (let index = 0; index < 4; index++) {
    const before = getPaintedScrollState((index + 0.36) * 0.22);
    const settled = getPaintedScrollState((index + 0.78) * 0.22);
    const crossing = getPaintedScrollState((index + 0.92) * 0.22);
    expect(before.interaction).toBe(0);
    expect(settled.interaction).toBeCloseTo(1);
    expect(crossing.dissolve).toBeGreaterThan(0);
    expect(crossing.interaction).toBe(1);
  }
});

test("reverse and rapid seeks produce the same authored pose without history", () => {
  const positions = [0.82, 0.15, 0.67, 0.35, 0.02, 1, 0.35];
  const first = getPaintedScrollState(0.35);
  const states = positions.map(getPaintedScrollState);
  expect(states.at(-1)).toEqual(first);
  expect(states[1].scene).toBe("opening");
  expect(states[2].scene).toBe("welcome");
});
