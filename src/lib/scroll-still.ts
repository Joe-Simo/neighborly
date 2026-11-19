import { whenIdle } from "@/lib/idle";

/**
 * Runs work once the page has been still for `settle` ms (and never before `notBefore` ms after this is called), then at an idle moment;
 * at the latest `latest` ms after it is called, still or not. Stillness is read from scrollY each frame, which costs no layout, not from
 * events: a jump by script, a keyboard scroll and Safari's momentum all count the same. Returns how to call it off.
 */
export function whenScrollStill(work: () => void, { settle = 250, notBefore = 1200, latest = 8000 } = {}): () => void {
  const opened = performance.now();
  let frame = 0, lastY = scrollY, stillSince = opened, stopIdle: (() => void) | undefined;
  const look = (now: number) => {
    if (scrollY !== lastY) { lastY = scrollY; stillSince = now; }
    const age = now - opened;
    if (age >= latest || (age >= notBefore && now - stillSince >= settle)) { stopIdle = whenIdle(work, 2000, 0); return; }
    frame = requestAnimationFrame(look);
  };
  frame = requestAnimationFrame(look);
  return () => { cancelAnimationFrame(frame); stopIdle?.(); };
}
