import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/**
 * How long a sheet stays after its yes, its corner green and its word showing, before it moves on:
 * the corner takes about 0.4 s to turn, which leaves 1.6 s of green to read the word. One timing in every room.
 */
export const FOLD_HOLD = 1800;

const LEAVE = 360;
const OPENING = "paper-open-up";

/**
 * After the hold, whatever is marked `data-fold-leaves` goes: it fades and closes up over 360ms, so what
 * is below glides into its place and the page never jumps. Await it, then take the sheet out of the data.
 * For anyone who asks for less motion it is a plain cut.
 */
export async function foldLeaves() {
  await Promise.all([...document.querySelectorAll<HTMLElement>("[data-fold-leaves]")].map((sheet) => closeUp(sheet)));
}

/**
 * How tall the page is without this piece of paper: taken out of the page for the measure and put straight
 * back ("gone"), or as the room will keep it for screen readers ("put away"). Nothing is painted in between.
 * Measured, not worked out, because margins fold together and rules about first and next neighbours change
 * when a thing leaves, and those differ from room to room.
 */
function pageWithout(sheet: HTMLElement, as: "gone" | "put away") {
  if (as === "put away") {
    const own = sheet.className;
    sheet.className = "sr-only";
    const height = document.body.offsetHeight;
    sheet.className = own;
    return height;
  }
  const { parentNode, nextSibling } = sheet;
  sheet.remove();
  const height = document.body.offsetHeight;
  parentNode?.insertBefore(sheet, nextSibling);
  return height;
}

/**
 * One piece of paper fades and closes up over 360ms, ending at exactly the height the page will have
 * without it; a plain cut for anyone who asks for less motion. `after` says what the room does with it next:
 * takes it out ("gone"), or keeps its words for screen readers only ("put away").
 */
export async function closeUp(sheet: HTMLElement, after: "gone" | "put away" = "gone") {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Its own arriving moves are over for good; being measured must not start them again.
  sheet.dataset.paperClosing = "";
  const { marginTop, marginBottom, paddingTop, paddingBottom } = getComputedStyle(sheet);
  const height = sheet.offsetHeight;
  sheet.style.boxSizing = "border-box";
  sheet.style.overflow = "hidden";
  holdThePage();
  const page = document.body.offsetHeight;
  const lost = page - pageWithout(sheet, after);
  const own = height + parseFloat(marginTop) + parseFloat(marginBottom);
  // Wholly above the window nobody sees it go, so it goes at once and what the person is looking at stays
  // where it is. Browsers that anchor the scroll do that themselves; the others are told.
  const unseen = sheet.getBoundingClientRect().bottom <= 0;
  if (unseen && !CSS.supports("overflow-anchor", "auto")) window.scrollBy(0, -lost);
  const timing = { duration: unseen ? 0 : LEAVE, fill: "forwards" } as const;
  // It stays readable to the end: the fade runs the whole length and is slow to start.
  sheet.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, easing: "cubic-bezier(0.6, 0, 0.9, 0.6)" });
  // A closed sheet still keeps its neighbours' margins apart, which its absence does not; the last margin makes up for it.
  await sheet.animate(
    [
      { height: `${height}px`, marginTop, marginBottom, paddingTop, paddingBottom },
      { height: "0px", marginTop: "0px", marginBottom: `${own - lost}px`, paddingTop: "0px", paddingBottom: "0px" },
    ],
    { ...timing, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  ).finished;
}

/**
 * The other way: a piece of paper just laid into the page opens its own room over the same 360ms, starting
 * from exactly the height the page had without it, so what is under it is moved aside and never jumps.
 * Call it before the browser paints (a layout effect or a ref). Nothing happens for anyone who asks for less motion.
 */
export function openUp(sheet: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Asked twice, it opens once: an opening already under way is dropped before the paper is measured.
  sheet.getAnimations().forEach((move) => move.id === OPENING && move.cancel());
  const { marginTop, marginBottom, paddingTop, paddingBottom } = getComputedStyle(sheet);
  const height = sheet.offsetHeight;
  holdThePage();
  const page = document.body.offsetHeight;
  const gained = page - pageWithout(sheet, "gone");
  const own = height + parseFloat(marginTop) + parseFloat(marginBottom);
  const closed = { overflow: "hidden", boxSizing: "border-box" };
  sheet.animate(
    [
      { ...closed, height: "0px", marginTop: "0px", marginBottom: `${own - gained}px`, paddingTop: "0px", paddingBottom: "0px" },
      { ...closed, height: `${height}px`, marginTop, marginBottom, paddingTop, paddingBottom },
    ],
    { id: OPENING, duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  );
}

/**
 * A page that gets shorter while someone is near its foot would be pulled up under their eyes by the
 * browser. So the page keeps the height that holds their place, and gives it back as soon as they
 * scroll up far enough not to need it.
 */
let letGo: (() => void) | undefined;
function holdThePage() {
  const page = document.documentElement;
  const held = window.scrollY;
  // Each closing holds the place the person is at now, not the place of an earlier one.
  letGo?.();
  page.style.minHeight = `${held + window.innerHeight}px`;
  const release = () => {
    if (window.scrollY === held || window.scrollY + window.innerHeight > document.body.offsetHeight) return;
    letGo?.();
  };
  letGo = () => {
    page.style.minHeight = "";
    window.removeEventListener("scroll", release);
    letGo = undefined;
  };
  window.addEventListener("scroll", release, { passive: true });
}

/** Undoes closeUp on a piece of paper that stays on the page for new words. */
function openFlat(sheet: HTMLElement) {
  if (!sheet.style.overflow) return;
  sheet.getAnimations().forEach((move) => move.cancel());
  sheet.style.overflow = "";
  sheet.style.boxSizing = "";
  delete sheet.dataset.paperClosing;
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
  // Before it is first painted, the line opens its own room; one that closed up before is opened flat first.
  useLayoutEffect(() => {
    if (!line.current) return;
    openFlat(line.current);
    openUp(line.current);
  }, [line, of]);
  useEffect(() => {
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
      if (now) void closeUp(now, "put away").then(() => setLeft(of));
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
