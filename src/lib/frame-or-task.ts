/**
 * A page can say it is visible and still draw no frames: a window behind another, a pane the browser has occluded. There
 * requestAnimationFrame never calls back, though nothing else is wrong, and a wait that only ends on a frame never ends.
 * Idle callbacks still come (Chrome measured ~3 s in an occluded pane, so they are asked for with a timeout).
 *
 * `frameOrTask` calls `then` once, on the first of the next frame or an idle callback. In a page that is drawing, the frame
 * comes first, as an idle period only follows a frame, so what waits on it is unchanged; where frames do not come, it still
 * goes on. Use it only for waits that gate progress, never for an animation's loop, which has nothing to draw without frames.
 *
 * Where there is no idle callback (Safari) it waits on the frame alone. A task in its place would nearly always run before
 * the frame, and so move every wait that is meant to come after a paint in a page that draws normally; Safari also reports a
 * window it does not draw as hidden, which next-look.ts handles without frames.
 *
 * The only file besides idle.ts allowed the idle callback API (eslint.config.mjs).
 */
export function frameOrTask(then: (now: number) => void): () => void {
  let done = false;
  let idle = 0;
  const stop = () => {
    done = true;
    cancelAnimationFrame(frame);
    if (idle) cancelIdleCallback(idle);
  };
  const go = (at?: unknown) => {
    if (done) return;
    stop();
    then(typeof at === "number" ? at : performance.now());
  };
  const frame = requestAnimationFrame(go);
  if (typeof requestIdleCallback === "function") idle = requestIdleCallback(() => go(), { timeout: 100 });
  return stop;
}
