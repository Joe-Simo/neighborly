import { useEffect, useState, type RefObject } from "react";

/**
 * How long a sheet stays after its yes, its corner green and its word showing, before it moves on:
 * the corner takes about 0.4 s to turn, which leaves 1.6 s of green to read the word. One timing in every room.
 */
export const FOLD_HOLD = 1800;

const LEAVE = 360;

/**
 * After the hold, whatever is marked `data-fold-leaves` goes: it fades and closes up over 360ms, so what
 * is below glides into its place and the page never jumps. Await it, then take the sheet out of the data.
 * For anyone who asks for less motion it is a plain cut.
 */
export async function foldLeaves() {
  await Promise.all([...document.querySelectorAll<HTMLElement>("[data-fold-leaves]")].map(closeUp));
}

/** One piece of paper fades and closes up over 360ms; a plain cut for anyone who asks for less motion. */
export async function closeUp(sheet: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { marginTop, marginBottom, paddingTop, paddingBottom } = getComputedStyle(sheet);
  const height = `${sheet.offsetHeight}px`;
  sheet.style.boxSizing = "border-box";
  sheet.style.overflow = "hidden";
  holdThePage();
  await sheet.animate(
    [
      { height, opacity: 1, marginTop, marginBottom, paddingTop, paddingBottom },
      { opacity: 0, offset: 0.85 },
      { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" },
    ],
    { duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "forwards" },
  ).finished;
}

/**
 * A page that gets shorter while someone is near its foot would be pulled up under their eyes by the
 * browser. So the page keeps the height that holds their place, and gives it back as soon as they
 * scroll up far enough not to need it.
 */
function holdThePage() {
  const page = document.documentElement;
  if (page.style.minHeight) return;
  const held = window.scrollY;
  page.style.minHeight = `${held + window.innerHeight}px`;
  const release = () => {
    if (window.scrollY === held || window.scrollY + window.innerHeight > document.body.offsetHeight) return;
    page.style.minHeight = "";
    window.removeEventListener("scroll", release);
  };
  window.addEventListener("scroll", release, { passive: true });
}

/** Undoes closeUp on a piece of paper that stays on the page for new words. */
function openFlat(sheet: HTMLElement) {
  if (!sheet.style.overflow) return;
  sheet.getAnimations().forEach((move) => move.cancel());
  sheet.style.overflow = "";
  sheet.style.boxSizing = "";
}

const never = Symbol("never");

/**
 * The green line that says what was done, in every room. True while the line is on the page; then the line
 * closes up and the answer turns false, and the room keeps the words as a message for screen readers only.
 * A plain line stays six seconds. A line that carries an action (`action: true`) stays twelve, and its clock
 * stops while the pointer is over it or its action has focus. A room that keeps one line mounted and changes
 * its words passes the words as `of`, so each new saying is seen afresh.
 */
export function useSavedLine(
  line: RefObject<HTMLElement | null>,
  { action = false, of }: { action?: boolean; of?: unknown } = {},
) {
  const [left, setLeft] = useState<unknown>(never);
  useEffect(() => {
    // A line that closed up before is opened flat again for its new words.
    if (line.current) openFlat(line.current);
    const stay = action ? 12000 : 6000;
    const step = 250;
    let shown = 0;
    const clock = window.setInterval(() => {
      const now = line.current;
      const held = now && (now.matches(":hover") || (now !== document.activeElement && now.contains(document.activeElement)));
      if (held) return;
      shown += step;
      if (shown < stay) return;
      window.clearInterval(clock);
      if (now) void closeUp(now).then(() => setLeft(of));
      else setLeft(of);
    }, step);
    return () => window.clearInterval(clock);
  }, [line, action, of]);
  // Once the room has put the words away for screen readers, the closing move is taken off them.
  useEffect(() => {
    if (left === of && line.current) openFlat(line.current);
  }, [left, of, line]);
  return left !== of;
}
