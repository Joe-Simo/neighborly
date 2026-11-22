/**
 * A page in the background (a hidden tab, a pane behind another) draws no frames: requestAnimationFrame never calls back
 * there, and an animation's `finished` never comes. A wait that is only ever looked at once a frame would stand there for
 * as long as the page is hidden, and the launch with it. These look instead when something that could end the wait
 * happens: the page changes (a room drawn, a picture marked ready), a font arrives, or the page is shown.
 */

/** Whether the page is drawing nothing now: nothing is seen, so nothing need wait for a frame or play out a move. */
export const unseen = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * Calls `look` once, on the next frame; in a hidden page on the next change to it, or the moment it is shown again.
 * Returns how to call it off. `look` is handed the time, as a frame's callback is.
 */
export function nextLook(look: (now: number) => void): () => void {
  if (!unseen()) {
    const frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }
  let off = false;
  const changes = new MutationObserver(() => go());
  const fonts = typeof document.fonts?.addEventListener === "function" ? document.fonts : null;
  const stop = () => {
    off = true;
    changes.disconnect();
    document.removeEventListener("visibilitychange", go);
    fonts?.removeEventListener("loadingdone", go);
  };
  function go() {
    if (off) return;
    stop();
    look(performance.now());
  }
  changes.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  document.addEventListener("visibilitychange", go);
  fonts?.addEventListener("loadingdone", go);
  return stop;
}

/** After the frame now being drawn has been painted; in a hidden page, where nothing is painted, straight after this task. */
export function afterAPaint(then: () => void) {
  if (unseen()) return void queueMicrotask(then);
  requestAnimationFrame(() => requestAnimationFrame(then));
}
