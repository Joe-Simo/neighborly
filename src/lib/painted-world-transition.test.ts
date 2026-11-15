import { expect, test } from "bun:test";
import { getPaintedTransitionInteraction, getPaintedSceneCut } from "./painted-world-transition";

test("a completed drag continues from its visible pose instead of snapping back", () => {
  expect(getPaintedTransitionInteraction(0.86, 0, 0.45)).toBe(0.86);
  expect(getPaintedTransitionInteraction(0.86, 0.01, 0.45)).toBeGreaterThanOrEqual(0.86);
  expect(getPaintedTransitionInteraction(0.86, 0.45, 0.45)).toBe(1);
});

test("transition interaction is monotonic and stays settled after the action completes", () => {
  for (const start of [0, 0.15, 0.8, 1]) {
    const positions = Array.from({ length: 11 }, (_, step) => getPaintedTransitionInteraction(start, step / 10, 0.62));
    expect(positions.every((position, index) => position >= (positions[index - 1] ?? start) && position <= 1)).toBe(true);
    expect(positions.at(-1)).toBe(1);
  }
});


test("painted human scenes never crossfade and switch behind full coverage", () => {
  for (const progress of [0, .25, .4999, .5, .5001, .75, 1]) {
    const cut = getPaintedSceneCut(progress);
    expect(cut.incomingOpacity + cut.outgoingOpacity).toBe(1);
    expect([0, 1]).toContain(cut.incomingOpacity);
    if (progress > .49 && progress < .51) {
      expect(cut.fullyCovered).toBe(true);
      expect(cut.left).toBeLessThan(-.03);
      expect(cut.right).toBeGreaterThan(1.03);
    }
  }
  expect(getPaintedSceneCut(.5, true).coverVisible).toBe(false);
});
