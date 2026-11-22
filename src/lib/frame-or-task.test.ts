import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { frameOrTask } from "./frame-or-task";
import { afterAPaint, nextLook } from "./next-look";

// A page that says it is visible and draws no frames: a window behind another. requestAnimationFrame never calls back.
let frames: FrameRequestCallback[] = [];
let idles: (() => void)[] = [];
const realIdle = () => globalThis.requestIdleCallback;
let keepIdle: typeof globalThis.requestIdleCallback | undefined;
beforeAll(() => {
  GlobalRegistrator.register();
  keepIdle = realIdle();
});
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  frames = [];
  idles = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  window.requestAnimationFrame = globalThis.requestAnimationFrame = (call) => frames.push(call);
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame = () => {};
  // Idle callbacks held, to be run when the test says, as the browser runs them after a frame or on their timeout.
  window.requestIdleCallback = globalThis.requestIdleCallback = ((call: () => void) => idles.push(call)) as typeof requestIdleCallback;
  window.cancelIdleCallback = globalThis.cancelIdleCallback = (id: number) => void (idles[id - 1] = () => {});
});
afterEach(() => {
  window.requestIdleCallback = globalThis.requestIdleCallback = keepIdle!;
  document.body.innerHTML = "";
});
const settle = () => new Promise((done) => setTimeout(done, 0));
const idle = () => idles.splice(0).forEach((call) => call());

test("with no frame ever drawn, the wait still ends, on an idle callback", () => {
  let went = 0;
  frameOrTask(() => went++);
  expect(went).toBe(0);
  idle();
  expect(went).toBe(1);
  expect(frames.length).toBe(1);
});

test("where frames are drawn, the frame comes first and the idle callback after it does nothing", () => {
  const times: number[] = [];
  frameOrTask((now) => times.push(now));
  frames.shift()!(1234);
  idle();
  expect(times).toEqual([1234]);
});

test("without idle callbacks (Safari), it waits on the frame alone, so no wait moves ahead of a paint", async () => {
  // @ts-expect-error -- Safari has none
  window.requestIdleCallback = globalThis.requestIdleCallback = undefined;
  let went = 0;
  frameOrTask(() => went++);
  await settle();
  expect(went).toBe(0);
  frames.shift()!(0);
  expect(went).toBe(1);
});

test("called off, it never goes", () => {
  let went = 0;
  frameOrTask(() => went++)();
  idle();
  frames.shift()?.(0);
  expect(went).toBe(0);
});

test("a visible page that draws no frames: nextLook still looks, and afterAPaint still goes", () => {
  let looked = 0, painted = 0;
  nextLook(() => looked++);
  afterAPaint(() => painted++);
  idle();
  expect(looked).toBe(1);
  expect(painted).toBe(0);
  idle();
  expect(painted).toBe(1);
});

test("a wait that looks again each time ends in a page that draws no frames", () => {
  let tries = 0, done = false;
  const look = () => (++tries === 3 ? (done = true) : nextLook(look));
  nextLook(look);
  for (let i = 0; i < 3; i++) idle();
  expect(done).toBe(true);
});
