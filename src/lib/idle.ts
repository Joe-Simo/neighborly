import { frameOrTask } from "./frame-or-task";

/**
 * Resolves once the page's first frame has been drawn: the first animation frame, then the task after it (that frame's paint).
 * A browser that is not yet drawing (a tab still opening, a phone busy elsewhere) fires no frames; idle work waits for it, so
 * nothing further down the page is fetched or made before the first screen is on the glass. A page that says it is visible
 * but draws nothing (a window behind another) goes on after an idle callback instead (frame-or-task.ts).
 */
let drawn: Promise<void> | undefined;
const firstFrame = () => (drawn ??= new Promise<void>((resolve) => frameOrTask(() => setTimeout(resolve, 0))));

/**
 * Runs work when the page is idle, after its first frame, and returns how to call it off. Safari has no requestIdleCallback, so there
 * it waits a short timer instead (`fallback` ms: by default the timeout or 200 ms, whichever is shorter). The timeout counts from the
 * first frame. The only file allowed to use the idle callback API (eslint.config.mjs).
 */
export function whenIdle(work: () => void, timeout?: number, fallback = Math.min(timeout ?? 200, 200)): () => void {
  let cancel: (() => void) | undefined, off = false;
  void firstFrame().then(() => {
    if (off) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(work, timeout === undefined ? undefined : { timeout });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(work, fallback);
      cancel = () => window.clearTimeout(id);
    }
  });
  return () => { off = true; cancel?.(); };
}
