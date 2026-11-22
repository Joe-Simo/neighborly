import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { afterAPaint, nextLook, unseen } from "./next-look";

// A background tab: hidden, and no frame ever drawn.
let state: DocumentVisibilityState = "hidden";
let frames = 0;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  state = "hidden";
  frames = 0;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  window.requestAnimationFrame = globalThis.requestAnimationFrame = () => ++frames;
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => (document.body.innerHTML = ""));
const settle = () => new Promise((done) => setTimeout(done, 0));
const show = () => {
  state = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
};

test("a hidden page asks for no frame, and looks again when the page changes", async () => {
  let looked = 0;
  nextLook(() => looked++);
  expect(unseen()).toBe(true);
  expect(frames).toBe(0);
  await settle();
  expect(looked).toBe(0);
  document.body.append(document.createElement("main"));
  await settle();
  expect(looked).toBe(1);
  // Once only: a further change is not looked at unless asked again.
  document.body.setAttribute("data-x", "");
  await settle();
  expect(looked).toBe(1);
});

test("a wait that looks again each time ends in a hidden page once what it waits for is there", async () => {
  let done = false;
  const look = () => {
    if (document.querySelector("[data-ready]")) done = true;
    else nextLook(look);
  };
  nextLook(look);
  document.body.append(document.createElement("div"));
  await settle();
  expect(done).toBe(false);
  document.querySelector("div")!.setAttribute("data-ready", "");
  await settle();
  expect(done).toBe(true);
  expect(frames).toBe(0);
});

test("shown again, the look comes at once, and the next one is a frame", async () => {
  let looked = 0;
  nextLook(() => looked++);
  show();
  expect(looked).toBe(1);
  nextLook(() => looked++);
  expect(frames).toBe(1);
});

test("called off, it never looks", async () => {
  let looked = 0;
  nextLook(() => looked++)();
  document.body.append(document.createElement("p"));
  show();
  await settle();
  expect(looked).toBe(0);
});

test("after a paint: at once in a hidden page, after two frames in a shown one", async () => {
  let went = 0;
  afterAPaint(() => went++);
  await settle();
  expect(went).toBe(1);
  state = "visible";
  const queued: FrameRequestCallback[] = [];
  window.requestAnimationFrame = globalThis.requestAnimationFrame = (call) => queued.push(call);
  afterAPaint(() => went++);
  queued.shift()!(0);
  expect(went).toBe(1);
  queued.shift()!(0);
  expect(went).toBe(2);
});
