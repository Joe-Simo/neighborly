import { expect, test } from "bun:test";
import { getPaintedArtworkFrame, getPaintedImagePoint, getPaintedLayerOffset, getPaintedOpeningFraming } from "./painted-world-framing";

test("intermediate portrait surfaces retain the whole authored portrait composition", () => {
  const frame = getPaintedOpeningFraming(789, 891, 14.61, 16.5);
  expect(frame.mobile).toBe(true);
  expect(frame.poster).toBe("/assets/living-relief-mobile.webp");
  expect(frame.sourceWidth * frame.scale).toBeLessThanOrEqual(14.61);
  expect(frame.sourceHeight * frame.scale).toBeLessThanOrEqual(16.5);
});

test("phone composition stays contained and keeps its original narrow asset", () => {
  const frame = getPaintedOpeningFraming(390, 754, 8.535, 16.5);
  expect(frame.mobile).toBe(true);
  expect(frame.narrow).toBe(true);
  expect(frame.poster).toBe("/assets/living-relief-narrow.webp");
  expect(frame.sourceWidth * frame.scale).toBeLessThanOrEqual(8.535);
  expect(frame.sourceHeight * frame.scale).toBeLessThanOrEqual(16.5);
});

test("painted layer motion preserves its authored offset, including reduced motion", () => {
  expect(getPaintedLayerOffset(-0.7425, 0, 0.7, false)).toBe(-0.7425);
  expect(getPaintedLayerOffset(-0.7425, 1, 0.7, true)).toBe(-0.7425);
  expect(getPaintedLayerOffset(-0.7425, 1, 0.7, false)).toBeCloseTo(-0.7369);
});


test("intermediate windows contain the entire landscape painting", () => {
  const frame = getPaintedArtworkFrame(789 / 671 * 10, 10, 16 / 9);
  expect(frame.contained).toBe(true);
  expect(frame.width).toBeLessThanOrEqual(789 / 671 * 10);
  expect(frame.height).toBeLessThanOrEqual(10);
});

test("portrait tablet painting and anchors share one contained rectangle", () => {
  const frame = getPaintedArtworkFrame(768 / 804 * 16.5, 16.5, 900 / 1600);
  expect(frame.contained).toBe(true);
  expect(frame.height).toBe(16.5);
  const topLeft = getPaintedImagePoint(0, 0, frame.width, frame.height, 0, -0.3);
  const bottomRight = getPaintedImagePoint(1, 1, frame.width, frame.height, 0, -0.3);
  expect(topLeft.x).toBeCloseTo(-frame.width / 2);
  expect(topLeft.y).toBeCloseTo(frame.height / 2 - 0.3);
  expect(bottomRight.x).toBeCloseTo(frame.width / 2);
  expect(bottomRight.y).toBeCloseTo(-frame.height / 2 - 0.3);
});

test("wide scenes preserve the complete composition without cropping", () => {
  const frame = getPaintedArtworkFrame(20, 10, 16 / 9);
  expect(frame.contained).toBe(true);
  expect(frame.width).toBeCloseTo(160 / 9);
  expect(frame.height).toBeCloseTo(10);
});

test("the home opening fills its box, keeps the top on phones, and never uses the narrow painting", () => {
  const phone = getPaintedOpeningFraming(390, 788, 8.166, 16.5, true);
  expect(phone.narrow).toBe(false);
  expect(phone.poster).toBe("/assets/living-relief-mobile.webp");
  expect(phone.sourceWidth * phone.scale).toBeGreaterThanOrEqual(8.166);
  expect(phone.sourceHeight * phone.scale).toBeGreaterThanOrEqual(16.5);
  // Top aligned: the painting moves down by half of what overflows.
  expect(phone.shiftY).toBeCloseTo(-(phone.sourceHeight * phone.scale - 16.5) / 2);

  const desktop = getPaintedOpeningFraming(1440, 824, 17.476, 10, true);
  const lost = desktop.sourceHeight * desktop.scale - 10;
  expect(lost).toBeGreaterThan(0);
  expect(desktop.shiftY).toBeCloseTo(-(.5 - .28) * lost);
});
