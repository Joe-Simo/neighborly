import { useEffect, useState, type RefObject } from "react";

/**
 * How long a sheet stays after its yes, its corner green and its word showing, before it moves on:
 * the fold itself (about half a second) and time to read the word. One timing in every room.
 */
export const FOLD_HOLD = 1600;

const LEAVE = 320;

/**
 * After the hold, whatever is marked `data-fold-leaves` goes: it fades and closes up over 320ms, so what
 * is below glides into its place and the page never jumps. Await it, then take the sheet out of the data.
 * For anyone who asks for less motion it is a plain cut.
 */
export async function foldLeaves() {
  await Promise.all([...document.querySelectorAll<HTMLElement>("[data-fold-leaves]")].map(closeUp));
}

/** One piece of paper fades and closes up over 320ms; a plain cut for anyone who asks for less motion. */
export async function closeUp(sheet: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { marginTop, marginBottom, paddingTop, paddingBottom } = getComputedStyle(sheet);
  const height = `${sheet.offsetHeight}px`;
  sheet.style.boxSizing = "border-box";
  sheet.style.overflow = "hidden";
  await sheet.animate(
    [
      { height, opacity: 1, marginTop, marginBottom, paddingTop, paddingBottom },
      { opacity: 0, offset: 0.6 },
      { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" },
    ],
    { duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "forwards" },
  ).finished;
}

/**
 * The green line that says what was done, in every room: true for six seconds, during which the line is
 * on the page; then the line closes up and the answer turns false, and the room keeps the words as a
 * message for screen readers only.
 */
export function useSeenForSix(line: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const leave = window.setTimeout(() => {
      const paper = line.current;
      if (paper) void closeUp(paper).then(() => setSeen(false));
      else setSeen(false);
    }, 6000);
    return () => window.clearTimeout(leave);
  }, [line]);
  return seen;
}
