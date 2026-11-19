import { whenIdle } from "@/lib/idle";
import { frameStep } from "@/lib/scroll-frame";

/**
 * Runs work once the page has been still for `settle` ms (and never before `notBefore` ms after this is called), then at an idle moment;
 * at the latest `latest` ms after it is called, still or not. Stillness is read from scrollY each frame, which costs no layout, not from
 * events: a jump by script, a keyboard scroll and Safari's momentum all count the same. Returns how to call it off.
 */
export function whenScrollStill(work: () => void, { settle = 250, notBefore = 1200, latest = 8000 } = {}): () => void {
  const opened = performance.now();
  let lastY = scrollY, y = lastY, stillSince = opened, stopIdle: (() => void) | undefined, done = false;
  // scrollY is read in the shared frame's first half (scroll-frame.ts): read after another part's writes, it made the page lay out again just to answer.
  const step = frameStep(() => { y = scrollY; }, now => {
    if (done) return;
    if (y !== lastY) { lastY = y; stillSince = now; }
    const age = now - opened;
    if (age >= latest || (age >= notBefore && now - stillSince >= settle)) { done = true; stopIdle = whenIdle(work, 2000, 0); return; }
    step.ask();
  });
  step.ask();
  return () => { done = true; step.drop(); stopIdle?.(); };
}
