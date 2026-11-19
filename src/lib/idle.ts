/**
 * Runs work when the page is idle, and returns how to call it off. Safari has no requestIdleCallback, so there it waits a short timer instead
 * (`fallback` ms: by default the timeout or 200 ms, whichever is shorter). The only file allowed to use the idle callback API (eslint.config.mjs).
 */
export function whenIdle(work: () => void, timeout?: number, fallback = Math.min(timeout ?? 200, 200)): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work, timeout === undefined ? undefined : { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, fallback);
  return () => window.clearTimeout(id);
}
