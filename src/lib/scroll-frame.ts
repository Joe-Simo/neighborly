/**
 * One frame for every scroll-driven part of a page: each part first reads what it needs of the layout, then all of them write.
 * Read in turn after one another's writes, every read made the browser style (and lay out) the page again inside the same frame;
 * on a phone that alone made frames of 50ms and more. Read together first, they all see the layout the last frame left, at no cost.
 */
type Step = { read: (time: number) => void; write: (time: number) => boolean | void };
const asked = new Set<Step>();
const settling = new Map<Step, number>();
let frame = 0;
const run = (time: number) => {
  frame = 0;
  const steps = [...asked];
  asked.clear();
  for (const step of steps) step.read(time);
  // A part that reads where other parts are drawn (the card, the heads) reads them before this frame's writes. When its own write
  // changed anything it is asked again, so it settles a frame later on where everything now lies, even after a jump with no further scroll.
  // It settles within a frame or two; a part that kept moving on its own is let go after three, until the next scroll asks again.
  for (const step of steps) {
    const settles = settling.get(step) ?? 0;
    if (step.write(time) === true && settles < 3) { settling.set(step, settles + 1); asked.add(step); if (!frame) frame = requestAnimationFrame(run); }
    else settling.delete(step);
  }
};

/** A part's step in the shared frame: `read` only measures, `write` only sets styles. Returns the function that asks for it, and the one that lets it go. */
export function frameStep(read: (time: number) => void, write: (time: number) => boolean | void) {
  const step: Step = { read, write };
  const ask = () => { settling.delete(step); asked.add(step); if (!frame) frame = requestAnimationFrame(run); };
  const drop = () => { asked.delete(step); };
  return { ask, drop };
}
