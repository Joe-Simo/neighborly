import { expect, test } from "bun:test";
import { getHallTransitionFraming, getEmbeddedHallTransitionFraming } from "./hall-transition-framing";

test("doorway approach covers portrait and desktop and centers the same source doorway", () => {
  for (const [width, height] of [[430, 932], [774, 875], [1440, 900], [1920, 720]]) {
    const rest = getHallTransitionFraming(width, height, 2, 0);
    const arrived = getHallTransitionFraming(width, height, 2, 1);
    expect(rest.imageWidth).toBeGreaterThanOrEqual(width);
    expect(rest.imageHeight).toBeGreaterThanOrEqual(height);
    expect(rest.imageWidth / rest.imageHeight).toBe(2);
    const left = (width - arrived.imageWidth) / 2 + arrived.originX * (1 - arrived.scale) + arrived.translateX;
    expect(left).toBeLessThanOrEqual(0);
    expect(left + arrived.imageWidth * arrived.scale).toBeGreaterThanOrEqual(width - 1e-8);
    expect(arrived.scale).toBe(2);
  }
});

test("reduced motion preserves the original cover composition", () => {
  const frame = getHallTransitionFraming(430, 932, 2, 1, true);
  expect(frame.scale).toBe(1);
  expect(frame.translateX).toBe(0);
});


test("embedded entry exactly matches courtyard hall framing at each aspect", () => {
  for (const [width, height] of [[430, 932], [774, 875], [1440, 900]]) {
    const entry = getEmbeddedHallTransitionFraming(width, height, 0);
    const expectedHeight = Math.max(height, width / 2) * 1.16 * (width < height ? 1 : 1.12);
    expect(entry.imageHeight).toBeCloseTo(expectedHeight);
    expect(entry.imageWidth).toBeCloseTo(expectedHeight * 2);
    expect(entry.translateX).toBeCloseTo(-.86 * ((entry.imageWidth - width) / 2) * .95);
    expect(entry.scale).toBe(1);
    const arrived = getEmbeddedHallTransitionFraming(width, height, 1);
    expect(arrived.scale).toBe(2);
    expect((width - arrived.imageWidth) / 2 + arrived.originX + arrived.translateX).toBeCloseTo(width / 2);
  }
});
