import { expect, test } from "bun:test";
import type { WebGLRenderer } from "three";
import { createPaperLift } from "./paper-lift";

test("paper settles once, closes completely, and does not keep requesting frames", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { innerWidth: 1000, innerHeight: 800 } });
  const paper = createPaperLift();
  const ready: boolean[] = [];
  const renderer = { autoClear: true, shadowMap: { enabled: false }, clearDepth() {}, render() {} } as unknown as WebGLRenderer;
  const bounds = { width: 1000, height: 800, left: 0, top: 0 } as DOMRect;
  try {
    paper.set(true, false, (value) => ready.push(value));
    expect(paper.draw(renderer, 0, bounds, { x: 100, y: 100 }, false)).toBe(true);
    expect(paper.draw(renderer, 0.61, bounds, { x: 100, y: 100 }, false)).toBe(true);
    expect(paper.draw(renderer, 0.61, bounds, { x: 100, y: 100 }, false)).toBe(false);
    expect(ready).toEqual([false, true]);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.shadowMap.enabled).toBe(false);
    paper.set(false, false, (value) => ready.push(value));
    expect(paper.draw(renderer, 0.68, bounds, { x: 100, y: 100 }, false)).toBe(false);
    expect(paper.active).toBe(false);
    expect(ready).toEqual([false, true, false]);
    paper.set(true, false, (value) => ready.push(value));
    expect(paper.draw(renderer, 0, bounds, { x: 100, y: 100 }, true)).toBe(false);
    expect(ready.at(-1)).toBe(true);
  } finally {
    paper.dispose();
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
