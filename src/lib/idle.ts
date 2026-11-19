/** Runs work when the page is idle, and returns how to call it off. Safari has no requestIdleCallback, so there it waits a short timer instead. */
export function whenIdle(work: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, Math.min(timeout, 200));
  return () => window.clearTimeout(id);
}
