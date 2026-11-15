import { expect, test } from "bun:test";
import { getCourtyardLayout, getGardenActionFrame, getHallActionFrame, getTableActionFrame, getJourneyPosition, getJourneyDestination, getJourneyZoom, getHarvestTransfer, getHarvestPlacement, getScrollCareFrame, getCandidateJourneyPosition } from "./courtyard-motion";

const actions = [
  { name: "table", sample: (time: number) => { const frame = getTableActionFrame(time); return { ...frame, first: frame.chair, second: frame.settings }; }, start: 600, firstEnd: 1500, secondStart: 1400 },
  { name: "garden", sample: (time: number) => { const frame = getGardenActionFrame(time); return { ...frame, first: frame.basket, second: frame.plants }; }, start: 650, firstEnd: 1500, secondStart: 1400 },
  { name: "hall", sample: (time: number) => { const frame = getHallActionFrame(time); return { ...frame, first: frame.chairs, second: frame.flowers }; }, start: 650, firstEnd: 1600, secondStart: 1500 },
] as const;

for (const action of actions) {
  test(`${action.name} stages objects before the final camera settle`, () => {
    expect(action.sample(action.start).first).toBe(0);
    expect(action.sample(action.secondStart).first).toBeGreaterThan(0);
    expect(action.sample(action.secondStart).second).toBe(0);
    expect(action.sample(action.firstEnd).first).toBe(1);
    expect(action.sample(2400).second).toBe(1);
    expect(action.sample(649).reveal).toBe(false);
    expect(action.sample(650).reveal).toBe(true);
    expect(action.sample(3199).complete).toBe(false);
    expect(action.sample(3200)).toMatchObject({ first: 1, second: 1, approach: 1, zoom: 0, complete: true });
  });

  test(`${action.name} has finite bounded poses during interrupted or reversed playback`, () => {
    const times = [-1, 0, action.start, 650, 1000, action.secondStart, action.firstEnd, 2000, 2400, 2800, 3200, 5000];
    const samples = times.map(action.sample);
    expect(samples.every(frame => [frame.approach, frame.first, frame.second, frame.zoom].every(Number.isFinite))).toBe(true);
    expect(samples.every(frame => frame.approach >= 0 && frame.approach <= 1 && frame.first >= 0 && frame.first <= 1 && frame.second >= 0 && frame.second <= 1 && frame.zoom >= 0 && frame.zoom <= .06)).toBe(true);
    expect(samples.every((frame, index) => index === 0 || (frame.first >= samples[index - 1].first && frame.second >= samples[index - 1].second))).toBe(true);
    const reverseSamples = [...times].reverse().map(action.sample);
    expect(reverseSamples).toEqual([...samples].reverse());
  });
}

test("courtyard layers cover phone, intermediate and desktop viewports at either pan limit", () => {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [774, 875], [1440, 900], [1920, 640]]) {
    const scene = getCourtyardLayout(width, height);
    expect(scene.width / scene.height).toBe(2);
    expect(scene.height).toBeGreaterThanOrEqual(height);
    expect(scene.width).toBeGreaterThanOrEqual(width);
    expect(scene.range).toBeGreaterThan(0);
    // Foreground travels farther than background; both must retain edge coverage.
    expect(scene.width / 2 - scene.range * .98).toBeGreaterThan(width / 2);
  }
});

import { createCourtyardMotion } from "./courtyard-motion";

function motionHarness(options: Parameters<typeof createCourtyardMotion>[1] = {}) {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const install = (name: string, value: unknown) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const values = new Map<string, string>();
  const writes: string[] = [];
  let bounds = { width: 1000, height: 500 };
  let resizeCallback = () => {};
  let intersectionCallback: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let time = 0;
  const host = Object.assign(new EventTarget(), {
    style: { touchAction: "", userSelect: "", getPropertyValue: (name: string) => values.get(name) ?? "", setProperty: (name: string, value: string) => { writes.push(name); values.set(name, value); }, removeProperty: (name: string) => values.delete(name) },
    dataset: {}, getAttribute: () => null, removeAttribute: () => {}, setAttribute: () => {},
    getBoundingClientRect: () => bounds, hasPointerCapture: () => false,
  });
  install("document", Object.assign(new EventTarget(), { hidden: false }));
  const media = Object.assign(new EventTarget(), { matches: false });
  install("matchMedia", () => media);
  install("ResizeObserver", class { constructor(private callback: () => void) { resizeCallback = callback; } observe() { this.callback(); } disconnect() {} });
  install("IntersectionObserver", class { constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) { intersectionCallback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} });
  install("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  install("cancelAnimationFrame", (id: number) => frames.delete(id));
  const controller = createCourtyardMotion(host as unknown as HTMLElement, options);
  controller.setOpen(true);
  return {
    controller, values, writes,
    setVisible(value: boolean) { intersectionCallback([{ isIntersecting: value }]); },
    setHidden(value: boolean) { Object.assign(document, { hidden: value }); document.dispatchEvent(new Event("visibilitychange")); },
    resize(width: number, height: number) { bounds = { width, height }; resizeCallback(); },
    setReducedMotion(value: boolean) { media.matches = value; media.dispatchEvent(new Event("change")); },
    advance(milliseconds: number) {
      const end = time + milliseconds;
      for (let count = 0; frames.size && time < end && count < 500; count++) {
        const callbacks = [...frames.values()]; frames.clear(); time += 16;
        callbacks.forEach(callback => callback(time));
      }
    },
    dispose() {
      controller.dispose();
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

test("disposal inside a reveal callback cannot restore cleaned-up styles", () => {
  const harness = motionHarness();
  try {
    harness.controller.playCare(1, () => harness.controller.dispose(), () => {});
    harness.advance(800);
    expect(harness.values.size).toBe(0);
  } finally { harness.dispose(); }
});

test("resetting a completed action survives subsequent camera writes", () => {
  const harness = motionHarness();
  try {
    harness.controller.playCare(1, () => {}, () => {});
    harness.advance(3500);
    expect(harness.values.get("--table-chair")).toBe("1.00000");
    harness.controller.resetCare(1);
    harness.controller.setDestination(0);
    harness.advance(2500);
    expect(harness.values.get("--table-chair")).toBe("0.00000");
    expect(harness.values.get("--table-settings")).toBe("0.00000");
  } finally { harness.dispose(); }
});


test("committing a scrubbed chair continues from its visible position", () => {
  const harness = motionHarness();
  try {
    harness.controller.scrubTable(.72);
    const originalPan = harness.values.get("--scene-x");
    let reveals = 0;
    let completions = 0;
    harness.controller.completeTable(() => reveals++, () => completions++);
    expect(harness.values.get("--table-chair")).toBe("0.72000");
    harness.advance(500);
    expect(Number(harness.values.get("--table-chair"))).toBeGreaterThanOrEqual(.72);
    expect(harness.values.get("--scene-x")).toBe(originalPan);
    expect(reveals).toBe(0);
    harness.advance(3000);
    expect(harness.values.get("--table-chair")).toBe("1.00000");
    expect(harness.values.get("--table-settings")).toBe("1.00000");
    expect(reveals).toBe(1);
    expect(completions).toBe(1);
  } finally { harness.dispose(); }
});


test("committing a scrubbed garden basket does not rewind or move the camera", () => {
  const harness = motionHarness();
  try {
    harness.controller.setDestination(0);
    harness.advance(2500);
    harness.controller.scrubCare(0, .63);
    const originalPan = harness.values.get("--scene-x");
    let reveals = 0;
    let completions = 0;
    harness.controller.completeCare(0, () => reveals++, () => completions++);
    expect(harness.values.get("--garden-basket")).toBe("0.63000");
    harness.advance(600);
    expect(harness.values.get("--garden-basket")).toBe("0.63000");
    expect(harness.values.get("--scene-x")).toBe(originalPan);
    expect(reveals).toBe(0);
    harness.advance(3000);
    expect(harness.values.get("--garden-basket")).toBe("1.00000");
    expect(harness.values.get("--garden-plants")).toBe("1.00000");
    expect(reveals).toBe(1);
    expect(completions).toBe(1);
  } finally { harness.dispose(); }
});


test("committing the hall flowers preserves the drag while chairs follow", () => {
  const harness = motionHarness();
  try {
    harness.controller.setDestination(2);
    harness.advance(2500);
    harness.controller.scrubCare(2, .68);
    const originalPan = harness.values.get("--scene-x");
    let reveals = 0;
    let completions = 0;
    harness.controller.completeCare(2, () => reveals++, () => completions++);
    expect(harness.values.get("--hall-flowers")).toBe("0.68000");
    harness.advance(1000);
    expect(Number(harness.values.get("--hall-flowers"))).toBeGreaterThanOrEqual(.68);
    expect(Number(harness.values.get("--hall-chairs"))).toBeGreaterThan(0);
    expect(harness.values.get("--scene-x")).toBe(originalPan);
    harness.advance(2500);
    expect(harness.values.get("--hall-flowers")).toBe("1.00000");
    expect(harness.values.get("--hall-chairs")).toBe("1.00000");
    expect(reveals).toBe(1);
    expect(completions).toBe(1);
  } finally { harness.dispose(); }
});


test("cancelled object placement returns in 250ms without moving the camera", () => {
  const harness = motionHarness();
  try {
    harness.controller.scrubCare(2, .8);
    const originalPan = harness.values.get("--scene-x");
    harness.controller.returnCare(2);
    expect(harness.values.get("--hall-flowers")).toBe("0.80000");
    harness.advance(128);
    const halfway = Number(harness.values.get("--hall-flowers"));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(.8);
    expect(harness.values.get("--scene-x")).toBe(originalPan);
    harness.advance(200);
    expect(harness.values.get("--hall-flowers")).toBe("0.00000");
    harness.controller.scrubCare(0, .7);
    harness.controller.returnCare(0);
    harness.advance(64);
    harness.controller.scrubCare(0, .9);
    harness.advance(400);
    expect(harness.values.get("--garden-basket")).toBe("0.90000");
    harness.controller.returnCare(0);
    harness.controller.setDestination(1);
    const cancelledAt = harness.values.get("--garden-basket");
    harness.advance(1500);
    expect(harness.values.get("--garden-basket")).toBe(cancelledAt);
  } finally { harness.dispose(); }
});


test("clearing care eases both objects, completes once and cancels cleanly", () => {
  const harness = motionHarness();
  try {
    harness.controller.playCare(0, () => {}, () => {});
    harness.advance(3500);
    const pan = harness.values.get("--scene-x");
    let completions = 0;
    harness.controller.clearCare(0, () => completions++);
    harness.advance(200);
    const basket = Number(harness.values.get("--garden-basket"));
    expect(basket).toBeGreaterThan(0);
    expect(basket).toBeLessThan(1);
    expect(harness.values.get("--garden-basket")).toBe(harness.values.get("--garden-plants"));
    expect(harness.values.get("--scene-x")).toBe(pan);
    harness.advance(400);
    expect(harness.values.get("--garden-basket")).toBe("0.00000");
    expect(harness.values.get("--garden-plants")).toBe("0.00000");
    expect(completions).toBe(1);
    harness.controller.scrubCare(1, .8);
    const cancel = harness.controller.clearCare(1, () => completions++);
    cancel(); cancel();
    expect(completions).toBe(2);
    expect(harness.values.get("--table-chair")).toBe("0.00000");
    harness.controller.clearCare(2, () => completions++);
    harness.controller.dispose();
    expect(completions).toBe(2);
    expect(harness.values.size).toBe(0);
  } finally { harness.dispose(); }
});


test("journey camera holds each destination and moves continuously between them", () => {
  expect([0, .2, .32].map(getJourneyPosition)).toEqual([.86, .86, .86]);
  expect([.45, .55, .66].map(getJourneyPosition)).toEqual([0, 0, 0]);
  expect([.8, .9, 1].map(getJourneyPosition)).toEqual([-.86, -.86, 0]);
  expect(getJourneyPosition(.385)).toBeCloseTo(.43);
  expect(getJourneyPosition(.73)).toBeCloseTo(-.43);
  expect(getJourneyDestination(.2)).toBe(0);
  expect(getJourneyDestination(.5)).toBe(1);
  expect(getJourneyDestination(.9)).toBe(2);
  let previous = .86;
  for (let step = 0; step <= 90; step++) {
    const position = getJourneyPosition(step / 100);
    expect(Number.isFinite(position) && position <= previous && position >= -.86).toBe(true);
    previous = position;
  }
  expect(getJourneyPosition(Number.NaN)).toBe(.86);
});

test("unchanged journey progress leaves a user gesture intact without destination callbacks", () => {
  const harness = motionHarness();
  try {
    harness.controller.setJourneyProgress(.2);
    harness.controller.setDestination(1);
    harness.advance(2500);
    const pan = harness.values.get("--scene-x");
    harness.controller.setJourneyProgress(.2);
    expect(harness.values.get("--scene-x")).toBe(pan);
    harness.controller.setJourneyProgress(.9);
    expect(Number.parseFloat(harness.values.get("--scene-x") ?? "NaN")).toBeLessThan(0);
    const finalPan = harness.values.get("--scene-x");
    harness.advance(1000);
    expect(harness.values.get("--scene-x")).toBe(finalPan);
  } finally { harness.dispose(); }
});


test("journey returns smoothly to the overview without changing the final story destination", () => {
  expect(getJourneyPosition(.9)).toBe(-.86);
  expect(getJourneyPosition(.95)).toBeCloseTo(-.43);
  expect(getJourneyPosition(1)).toBe(0);
  expect(getJourneyDestination(1)).toBe(2);
  expect(getJourneyPosition(.900001)).toBeCloseTo(getJourneyPosition(.9), 8);
  let previous = -.86;
  for (let step = 90; step <= 100; step++) {
    const position = getJourneyPosition(step / 100);
    expect(position).toBeGreaterThanOrEqual(previous);
    expect(position).toBeLessThanOrEqual(0);
    previous = position;
  }
});


test("motion preference changes reapply stored journey framing without a new scroll event", () => {
  const harness = motionHarness();
  try {
    harness.controller.setJourneyProgress(.4);
    const movingPosition = harness.values.get("--scene-x");
    harness.setReducedMotion(true);
    expect(harness.values.get("--scene-x")).toBe("0.00px");
    harness.setReducedMotion(false);
    expect(harness.values.get("--scene-x")).toBe(movingPosition);
    harness.controller.setJourneyProgress(.97);
    harness.setReducedMotion(true);
    expect(harness.values.get("--scene-x")).toBe("0.00px");
  } finally { harness.dispose(); }
});

test("motion preference changes preserve manual framing before any journey progress", () => {
  const harness = motionHarness();
  try {
    harness.controller.setDestination(2);
    harness.advance(2500);
    const manualPosition = harness.values.get("--scene-x");
    harness.setReducedMotion(true);
    expect(harness.values.get("--scene-x")).toBe(manualPosition);
  } finally { harness.dispose(); }
});


test("journey zoom frames desktop acts while keeping portrait and endpoint at full composition", () => {
  expect(getJourneyZoom(0, false)).toBe(1);
  expect(getJourneyZoom(.2, false)).toBe(1.12);
  expect(getJourneyZoom(.5, false)).toBe(1.18);
  expect(getJourneyZoom(.85, false)).toBe(1.12);
  expect(getJourneyZoom(1, false)).toBe(1);
  for (const progress of [0, .1, .32, .4, .45, .66, .73, .8, .9, 1]) {
    expect(getJourneyZoom(progress, true)).toBe(1);
    expect(getJourneyZoom(progress, false)).toBeGreaterThanOrEqual(1);
    expect(getJourneyZoom(progress, false)).toBeLessThanOrEqual(1.18);
  }
  expect(getJourneyZoom(.320001, false)).toBeCloseTo(getJourneyZoom(.32, false), 8);
  expect(getJourneyZoom(.450001, false)).toBeCloseTo(getJourneyZoom(.45, false), 8);
});

test("journey zoom resizes both aligned layers and returns them to original dimensions", () => {
  const harness = motionHarness();
  try {
    const originalWidth = harness.values.get("--scene-width");
    const originalHeight = harness.values.get("--scene-height");
    harness.controller.setJourneyProgress(.5);
    expect(Number.parseFloat(harness.values.get("--scene-width") ?? "0")).toBeCloseTo(Number.parseFloat(originalWidth ?? "0") * 1.18, 2);
    expect(Number.parseFloat(harness.values.get("--scene-height") ?? "0")).toBeCloseTo(Number.parseFloat(originalHeight ?? "0") * 1.18, 2);
    harness.controller.setJourneyProgress(1);
    expect(harness.values.get("--scene-width")).toBe(originalWidth);
    expect(harness.values.get("--scene-height")).toBe(originalHeight);
  } finally { harness.dispose(); }
});


test("style writes skip unchanged values while resize and actions update their own variables", () => {
  const harness = motionHarness();
  try {
    harness.advance(100);
    harness.writes.length = 0;
    harness.controller.setOpen(true);
    harness.controller.scrubCare(1, 0);
    harness.advance(100);
    expect(harness.writes).toEqual([]);
    harness.controller.scrubCare(1, .5);
    expect(harness.writes).toEqual(["--table-chair"]);
    harness.writes.length = 0;
    harness.resize(1200, 600);
    expect(harness.writes).toContain("--scene-width");
    expect(harness.writes).toContain("--scene-height");
    expect(harness.writes).not.toContain("--table-chair");
    expect(harness.values.get("--table-chair")).toBe("0.50000");
  } finally { harness.dispose(); }
});


test("scroll takeover clears the temporary action zoom before the final overview", () => {
  const harness = motionHarness();
  try {
    harness.controller.setJourneyProgress(.55);
    harness.controller.playCare(1, () => {}, () => {});
    harness.advance(1400);
    expect(Number(harness.values.get("--care-zoom"))).toBeGreaterThan(0);
    harness.controller.setJourneyProgress(.8);
    expect(harness.values.get("--care-zoom")).toBe("0.00000");
    harness.controller.setJourneyProgress(1);
    harness.advance(3500);
    expect(harness.values.get("--care-zoom")).toBe("0.00000");
  } finally { harness.dispose(); }
});


test("the single harvest basket transfers from garden to table with reversible scroll", () => {
  expect([-.1, 0, .32].map(getHarvestTransfer)).toEqual([0, 0, 0]);
  expect(getHarvestTransfer(.385)).toBeCloseTo(.5);
  expect([.45, .8, 1, 2].map(getHarvestTransfer)).toEqual([1, 1, 1, 1]);
  expect(getHarvestTransfer(Number.NaN)).toBe(0);
  const samples = [.32, .34, .385, .42, .45];
  const forward = samples.map(getHarvestTransfer);
  expect(forward.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  expect([...samples].reverse().map(getHarvestTransfer)).toEqual([...forward].reverse());
  const harness = motionHarness();
  try {
    harness.controller.setJourneyProgress(.45);
    expect(harness.values.get("--harvest-transfer")).toBe("1.00000");
    harness.controller.setJourneyProgress(.32);
    expect(harness.values.get("--harvest-transfer")).toBe("0.00000");
  } finally { harness.dispose(); }
});


test("reduced motion places the harvest without an intermediate travelling pose", () => {
  const harness = motionHarness();
  try {
    harness.controller.setJourneyProgress(.36);
    expect(Number(harness.values.get("--harvest-transfer"))).toBeGreaterThan(0);
    harness.setReducedMotion(true);
    expect(harness.values.get("--harvest-transfer")).toBe("0.00000");
    harness.controller.setJourneyProgress(.4);
    expect(harness.values.get("--harvest-transfer")).toBe("1.00000");
    harness.setReducedMotion(false);
    expect(Number(harness.values.get("--harvest-transfer"))).toBeLessThan(1);
  } finally { harness.dispose(); }
});


test("harvest placement changes only while the single basket is invisible", () => {
  expect(getHarvestPlacement(.34)).toEqual({ position: 0, opacity: 1 });
  expect(getHarvestPlacement(.375)).toEqual({ position: 0, opacity: 0 });
  expect(getHarvestPlacement(.39)).toEqual({ position: 1, opacity: 0 });
  expect(getHarvestPlacement(.405)).toEqual({ position: 1, opacity: 0 });
  expect(getHarvestPlacement(.45)).toEqual({ position: 1, opacity: 1 });
  for (const boundary of [.34, .375, .39, .405, .45]) {
    expect(Math.abs(getHarvestPlacement(boundary - .000001).opacity - getHarvestPlacement(boundary + .000001).opacity)).toBeLessThan(.00001);
  }
  for (let step = 0; step <= 100; step++) {
    const frame = getHarvestPlacement(step / 100);
    expect(frame.position === 0 || frame.position === 1).toBe(true);
    expect(Number.isFinite(frame.opacity) && frame.opacity >= 0 && frame.opacity <= 1).toBe(true);
  }
  expect(getHarvestPlacement(.384, true)).toEqual({ position: 0, opacity: 1 });
  expect(getHarvestPlacement(.385, true)).toEqual({ position: 1, opacity: 1 });
});


test("reduced motion holds a stable shot size within each chapter", () => {
  const harness = motionHarness();
  try {
    harness.setReducedMotion(true);
    harness.controller.setJourneyProgress(.33);
    const garden = harness.values.get("--scene-width");
    harness.controller.setJourneyProgress(.37);
    expect(harness.values.get("--scene-width")).toBe(garden);
    harness.controller.setJourneyProgress(.4);
    const table = harness.values.get("--scene-width");
    harness.controller.setJourneyProgress(.7);
    expect(harness.values.get("--scene-width")).toBe(table);
    harness.controller.setJourneyProgress(.96);
    const ending = harness.values.get("--scene-width");
    harness.controller.setJourneyProgress(1);
    expect(harness.values.get("--scene-width")).toBe(ending);
  } finally { harness.dispose(); }
});


test("scroll before reveal cancels; after reveal it takes the camera while objects finish", () => {
  const harness = motionHarness();
  try {
    let reveals = 0;
    let completions = 0;
    harness.controller.playCare(0, () => reveals++, () => completions++);
    harness.advance(300);
    harness.controller.setJourneyProgress(.5);
    harness.advance(3500);
    expect(reveals).toBe(0);
    expect(completions).toBe(1);
    expect(harness.values.get("--garden-basket")).toBe("0.00000");
    harness.controller.playCare(0, () => reveals++, () => completions++);
    harness.advance(800);
    harness.resize(900, 600);
    const beforeScroll = harness.values.get("--garden-plants");
    harness.controller.setJourneyProgress(.6);
    expect(harness.values.get("--garden-plants")).toBe(beforeScroll);
    const camera = harness.values.get("--scene-x");
    harness.advance(3500);
    expect(harness.values.get("--scene-x")).toBe(camera);
    expect(reveals).toBe(1);
    expect(completions).toBe(2);
    expect(harness.values.get("--garden-basket")).toBe("1.00000");
    expect(harness.values.get("--garden-plants")).toBe("1.00000");
  } finally { harness.dispose(); }
});

test("navigation cancellation cannot write styles after its completion callback disposes the scene", () => {
  const harness = motionHarness();
  try {
    harness.controller.playCare(0, () => {}, () => harness.controller.dispose());
    harness.advance(200);
    harness.controller.setDestination(2);
    expect(harness.values.size).toBe(0);
    harness.advance(1000);
    expect(harness.values.size).toBe(0);
  } finally { harness.dispose(); }
});

test("reduced-motion reveal disposal suppresses the later completion callback", () => {
  const harness = motionHarness();
  try {
    harness.setReducedMotion(true);
    let completions = 0;
    harness.controller.playCare(1, () => harness.controller.dispose(), () => completions++);
    expect(completions).toBe(0);
    expect(harness.values.size).toBe(0);
  } finally { harness.dispose(); }
});


test("candidate response framing eases in, resets, and yields to native scroll", () => {
  const harness = motionHarness({ responseFocus: true });
  try {
    harness.controller.setJourneyProgress(.55);
    harness.controller.playCare(1, () => {}, () => {});
    harness.advance(4500);
    expect(Number(harness.values.get("--care-zoom"))).toBeCloseTo(.08, 3);
    expect(Number.parseFloat(harness.values.get("--scene-x") ?? "0")).toBeLessThan(0);
    harness.controller.clearCare(1, () => {});
    harness.advance(2000);
    expect(harness.values.get("--care-zoom")).toBe("0.00000");
    harness.controller.playCare(2, () => {}, () => {});
    harness.advance(4500);
    expect(Number(harness.values.get("--care-zoom"))).toBeCloseTo(.1, 3);
    harness.controller.setJourneyProgress(.85);
    expect(harness.values.get("--care-zoom")).toBe("0.00000");
  } finally { harness.dispose(); }
});

test("portrait candidate response avoids extra cropping", () => {
  const harness = motionHarness({ responseFocus: true });
  try {
    harness.resize(430, 932);
    harness.controller.playCare(2, () => {}, () => {});
    harness.advance(4500);
    expect(harness.values.get("--care-zoom")).toBe("0.00000");
  } finally { harness.dispose(); }
});


test("candidate portrait finale contains the full panorama and overview resets on navigation", () => {
  const harness = motionHarness({ responseFocus: true });
  try {
    harness.resize(430, 932);
    harness.controller.setJourneyProgress(1);
    expect(harness.values.get("--scene-width")).toBe("430.00px");
    expect(harness.values.get("--scene-height")).toBe("215.00px");
    expect(harness.values.get("--scene-x")).toBe("0.00px");
    harness.controller.setJourneyProgress(.55);
    harness.controller.showOverview();
    harness.advance(2000);
    expect(harness.values.get("--scene-width")).toBe("430.00px");
    harness.controller.setDestination(1);
    harness.advance(2000);
    expect(Number.parseFloat(harness.values.get("--scene-width") ?? "0")).toBeGreaterThan(430);
  } finally { harness.dispose(); }
});

test("ordinary portrait experience keeps its existing cover framing at the finale", () => {
  const harness = motionHarness();
  try {
    harness.resize(430, 932);
    harness.controller.setJourneyProgress(1);
    expect(Number.parseFloat(harness.values.get("--scene-width") ?? "0")).toBeGreaterThan(430);
  } finally { harness.dispose(); }
});


test("scroll care samples three reversible staged actions at their authored boundaries", () => {
  expect(getScrollCareFrame(.2).garden.basket).toBe(0);
  expect(getScrollCareFrame(.31).completed).toEqual([true, false, false]);
  expect(getScrollCareFrame(.64).completed).toEqual([true, true, false]);
  expect(getScrollCareFrame(.93).completed).toEqual([true, true, true]);
  const mid = getScrollCareFrame(.55);
  expect(mid.table.chair).toBeGreaterThan(0);
  expect(mid.table.settings).toBeLessThan(1);
  expect(getScrollCareFrame(.55)).toEqual(mid);
  expect(getScrollCareFrame(.55, true).table.settings).toBe(0);
});

test("manual care overrides scroll only until the next changed progress", () => {
  const milestones: (readonly boolean[])[] = [];
  const harness = motionHarness({ scrollCare: true, onScrollCare: states => milestones.push(states) });
  try {
    harness.controller.setJourneyProgress(.31);
    harness.controller.setJourneyProgress(.32);
    expect(milestones).toEqual([[true, false, false]]);
    harness.controller.scrubCare(1, .8);
    harness.controller.setJourneyProgress(.32);
    expect(harness.values.get("--table-chair")).toBe("0.80000");
    harness.controller.setJourneyProgress(.33);
    expect(harness.values.get("--table-chair")).toBe("0.00000");
    harness.controller.setJourneyProgress(.95);
    expect(milestones.at(-1)).toEqual([true, true, true]);
    harness.controller.setJourneyProgress(.1);
    expect(milestones.at(-1)).toEqual([false, false, false]);
    expect(harness.values.get("--garden-basket")).toBe("0.00000");
  } finally { harness.dispose(); }
});


test("candidate holds the hall through its final response before returning to the panorama", () => {
  expect(getCandidateJourneyPosition(.9)).toBe(-.86);
  expect(getCandidateJourneyPosition(.94)).toBe(-.86);
  expect(getCandidateJourneyPosition(.95)).toBe(-.86);
  expect(getCandidateJourneyPosition(.975)).toBeCloseTo(-.43);
  expect(getCandidateJourneyPosition(1)).toBe(0);
  expect(getJourneyPosition(.94)).not.toBe(-.86);
  const harness = motionHarness({ responseFocus: true });
  try {
    harness.controller.setJourneyProgress(.94);
    expect(Number.parseFloat(harness.values.get("--scene-x") ?? "0")).toBeLessThan(0);
    const hall = harness.values.get("--scene-x");
    harness.controller.setJourneyProgress(.95);
    expect(harness.values.get("--scene-x")).toBe(hall);
    harness.controller.setJourneyProgress(1);
    expect(harness.values.get("--scene-x")).toBe("0.00px");
  } finally { harness.dispose(); }
});


test("scroll reasserts completed semantics after a manual reset at the same milestone", () => {
  const states: (readonly boolean[])[] = [];
  const harness = motionHarness({ scrollCare: true, onScrollCare: value => states.push(value) });
  try {
    harness.controller.setJourneyProgress(.7);
    expect(states.at(-1)).toEqual([true, true, false]);
    harness.controller.resetCare(1);
    expect(harness.values.get("--table-chair")).toBe("0.00000");
    const count = states.length;
    harness.controller.setJourneyProgress(.7);
    expect(states.length).toBe(count);
    harness.controller.setJourneyProgress(.71);
    expect(states.length).toBe(count + 1);
    expect(states.at(-1)).toEqual([true, true, false]);
    expect(harness.values.get("--table-chair")).toBe("1.00000");
  } finally { harness.dispose(); }
});


test("explicit care survives stale offscreen state and document hiding", () => {
  const harness = motionHarness();
  let revealed = 0;
  let completed = 0;
  try {
    harness.setVisible(false);
    harness.controller.playCare(0, () => revealed++, () => completed++);
    expect([revealed, completed]).toEqual([1, 1]);
    expect(harness.values.get("--garden-basket")).toBe("1.00000");
    harness.setVisible(true);
    harness.controller.playCare(1, () => revealed++, () => completed++);
    harness.advance(100);
    harness.setHidden(true);
    expect([revealed, completed]).toEqual([2, 2]);
    expect(harness.values.get("--table-settings")).toBe("1.00000");
    harness.setHidden(false);
    harness.advance(4000);
    expect([revealed, completed]).toEqual([2, 2]);
  } finally { harness.dispose(); }
});

test("a committed drag completes when its scene leaves the viewport", () => {
  const harness = motionHarness();
  let revealed = 0;
  let completed = 0;
  try {
    harness.controller.scrubCare(2, .6);
    harness.controller.completeCare(2, () => revealed++, () => completed++);
    harness.advance(100);
    harness.setVisible(false);
    expect([revealed, completed]).toEqual([1, 1]);
    expect(harness.values.get("--hall-flowers")).toBe("1.00000");
    harness.setVisible(true);
    harness.advance(4000);
    expect([revealed, completed]).toEqual([1, 1]);
  } finally { harness.dispose(); }
});


test("accepted invitation reframes only the portrait table and preserves scene coverage", () => {
  const h = motionHarness();
  try {
    h.resize(390, 844);
    h.controller.setDestination(1);
    h.advance(1500);
    const before = Number.parseFloat(h.values.get("--scene-x") ?? "0");
    h.controller.setInvitationAccepted(true);
    const after = Number.parseFloat(h.values.get("--scene-x") ?? "0");
    expect(after - before).toBeCloseTo(100, 1);
    expect(h.values.get("--fore-x")).toBe(h.values.get("--scene-x"));
    const halfWidth = Number.parseFloat(h.values.get("--scene-width") ?? "0") / 2;
    expect(halfWidth - Math.abs(after)).toBeGreaterThanOrEqual(195);
    h.controller.setInvitationAccepted(false);
    expect(Number.parseFloat(h.values.get("--scene-x") ?? "0")).toBeCloseTo(before, 1);
    h.controller.setInvitationAccepted(true);
    h.resize(1440, 900);
    expect(Number.parseFloat(h.values.get("--scene-x") ?? "0")).toBeCloseTo(0, 1);
    h.resize(390, 844);
    h.controller.setDestination(0);
    h.advance(1500);
    const garden = h.values.get("--scene-x");
    h.controller.setInvitationAccepted(false);
    expect(h.values.get("--scene-x")).toBe(garden);
  } finally { h.dispose(); }
});
