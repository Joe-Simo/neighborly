import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * How long a sheet stays after its yes, its corner green and its word showing, before it moves on:
 * the corner takes about 0.4 s to turn, which leaves 1.6 s of green to read the word. One timing in every room.
 */
export const FOLD_HOLD = 1800;

const LEAVE = 360;
const OPENING = "paper-open-up";
const GROWING = "paper-grows";
/** Where a held line comes from and goes to: just above its place, behind the bar or off the window. */
const HELD_AWAY = "translateY(calc(-100% - 8px - var(--live-bar, 0px)))";

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
 * The margin under a piece of paper closed to nothing that makes the page exactly `target` tall. It is found
 * by trying, not by sums: a closed sheet keeps its neighbours' margins apart where its absence lets them
 * fold together, and folded margins do not add up. Nothing is painted while it tries.
 */
function closedMargin(sheet: HTMLElement, target: number) {
  const { style } = sheet;
  const kept = style.cssText;
  Object.assign(style, { boxSizing: "border-box", overflow: "hidden", height: "0px", minHeight: "0px", marginTop: "0px", paddingTop: "0px", paddingBottom: "0px" });
  let margin = 0;
  for (let turn = 0; turn < 6; turn++) {
    style.marginBottom = `${margin}px`;
    const over = document.body.offsetHeight - target;
    if (!over) break;
    margin -= over;
  }
  style.cssText = kept;
  return `${margin}px`;
}

/** Measures with every opening that is under way set to its end: the page as it will be once they are done. */
function onceOpened<T>(measure: () => T) {
  const moves = document.getAnimations().filter((move) => move.id === OPENING);
  const at = moves.map((move) => move.currentTime);
  moves.forEach((move) => (move.currentTime = LEAVE));
  const found = measure();
  moves.forEach((move, index) => (move.currentTime = at[index]));
  return found;
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
  // A line held under the top edge has no room in the page, so leaving moves nothing else.
  if (sheet.dataset.paperHeld !== undefined) {
    // It lies over the page, so it is never see-through: it slides back up under the top edge, whole.
    await sheet.animate([{ transform: "none" }, { transform: HELD_AWAY }], { duration: LEAVE, fill: "forwards", easing: "cubic-bezier(0.6, 0, 0.9, 0.6)" }).finished;
    sheet.style.visibility = "hidden";
    sheet.style.pointerEvents = "none";
    return;
  }
  const style = getComputedStyle(sheet);
  const { marginTop, marginBottom, paddingTop, paddingBottom } = style;
  const height = sheet.offsetHeight;
  sheet.style.boxSizing = "border-box";
  sheet.style.overflow = "hidden";
  holdThePage();
  // Where the close must end: the page without this paper, and with whatever is opening beside it open.
  const { lost, closed } = onceOpened(() => {
    const page = document.body.offsetHeight;
    const without = pageWithout(sheet, after);
    return { lost: page - without, closed: closedMargin(sheet, without) };
  });
  // Wholly above the window nobody sees it go, so it goes at once and what the person is looking at stays
  // where it is. Browsers that anchor the scroll do that themselves; the others are told.
  const unseen = home(sheet).bottom <= viewTop();
  // A saved line whose place is above the window is held in view under the top edge (paper.css). The person
  // does see that one go: it fades where it is, and only then is its room above the window given up, at once.
  const carried = unseen && sheet.getBoundingClientRect().bottom > viewTop();
  const fade = "cubic-bezier(0.6, 0, 0.9, 0.6)";
  if (carried) await sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LEAVE, fill: "forwards", easing: fade }).finished;
  if (unseen && !anchored(sheet)) window.scrollBy(0, -lost);
  const timing = { duration: unseen ? 0 : LEAVE, fill: "forwards" } as const;
  // It stays readable to the end: the fade runs the whole length and is slow to start.
  sheet.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, easing: fade });
  await sheet.animate(
    [
      { height: `${height}px`, minHeight: "0px", marginTop, marginBottom, paddingTop, paddingBottom },
      { height: edge(style), minHeight: "0px", marginTop: "0px", marginBottom: closed, paddingTop: "0px", paddingBottom: "0px" },
    ],
    { ...timing, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  ).finished;
}

/**
 * How thin a piece of paper is when it is shut: its own edge. No height takes its borders away, so it shuts to them
 * and not to nothing. Its room then shrinks or grows evenly to the end, and a sheet that opens while another shuts
 * takes, on every frame, exactly the room the other gives up.
 */
function edge(style: CSSStyleDeclaration) {
  return `${parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)}px`;
}

/** Whether the browser itself keeps the view in place around this paper: it can, and no room it lies in says not to. */
function anchored(sheet: HTMLElement) {
  if (!CSS.supports("overflow-anchor", "auto")) return false;
  for (let room = sheet.parentElement; room; room = room.parentElement)
    if (getComputedStyle(room).overflowAnchor === "none") return false;
  return true;
}

let pageBefore: number | undefined;
/**
 * For a change that puts one thing where another was (a row where the empty list's words were): run the
 * change inside this, and whatever opens during it starts from the page as it truly was.
 */
export function arriving(change: () => void) {
  pageBefore = document.body.offsetHeight;
  change();
  pageBefore = undefined;
}

/**
 * Where the window's own top edge is for the page: under the bar when the bar is held (under 900px), else 0.
 * Anything that asks "is this in view" measures from here, so nothing counts as seen while it lies under the bar.
 */
export function viewTop() {
  const bar = document.querySelector(".live-header");
  return bar && getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0;
}

/** Where a piece of paper lies in the page itself, whether or not it is being held in view just now. */
function home(sheet: HTMLElement) {
  const held = sheet.style.position;
  sheet.style.position = "static";
  const place = sheet.getBoundingClientRect();
  sheet.style.position = held;
  return place;
}

/** Whether paper laid here now is held under the top edge (openUp), its place being above the window or under the bar. */
export function heldWhenLaid(sheet: HTMLElement, place = home(sheet)) {
  return place.top < viewTop() && !sheet.closest(".live-dialog");
}

/**
 * The other way: a piece of paper just laid into the page opens its own room over the same 360ms, starting
 * from exactly the height the page had before it, so what is under it is moved aside and never jumps.
 * Call it before the browser paints (a layout effect or a ref). Nothing happens for anyone who asks for less motion.
 */
export function openUp(sheet: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Asked twice, it opens once: an opening already under way is dropped before the paper is measured.
  sheet.getAnimations().forEach((move) => move.id === OPENING && move.cancel());
  // Laid in above the window (or under the bar), it takes no room in the page at all: it is drawn held under
  // the top edge, out of the page's flow, so nothing the person is looking at moves and there is nothing to
  // make up for in any browser. A dialog scrolls its own paper, so a line in one keeps its place there.
  const place = home(sheet);
  if (heldWhenLaid(sheet, place)) {
    Object.assign(sheet.style, {
      position: "fixed",
      top: "calc(var(--live-bar, 0px) + var(--live-pan, 0px) + 8px)",
      left: `${place.left}px`,
      width: `${place.width}px`,
      margin: "0",
      zIndex: "15",
    });
    sheet.dataset.paperHeld = "";
    // Whole from its first frame: it comes down from under the top edge and is never drawn half faded over a row.
    sheet.style.animation = "none";
    sheet.animate([{ transform: HELD_AWAY }, { transform: "none" }], { duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    return;
  }
  openRoom(sheet);
}

/**
 * The next sheet, laid where another is closing (the next draft under a yes): its room opens over the same 360ms
 * as the other's closes, so what is under the two moves once, from the one height to the other, and never jumps.
 * The room keeps it unseen while its room opens and lays it down whole once the other has gone. Should the sheet
 * it follows lie wholly above the window, nobody sees either go or come: it is laid at once, and the window keeps
 * what the person is looking at. Call it before the browser paints. Nothing moves for anyone who asks for less motion.
 */
export function openInPlaceOf(sheet: HTMLElement, going: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (home(going).bottom > viewTop()) return openRoom(sheet);
  if (!anchored(sheet)) window.scrollBy(0, document.body.offsetHeight - pageWithout(sheet, "gone"));
}

/** Opens the room of a piece of paper just laid in the page, from exactly the page as it was without it. */
function openRoom(sheet: HTMLElement) {
  const style = getComputedStyle(sheet);
  const { marginTop, marginBottom, paddingTop, paddingBottom } = style;
  const height = sheet.offsetHeight;
  holdThePage();
  const shut = { overflow: "hidden", boxSizing: "border-box", minHeight: "0px" };
  const from = closedMargin(sheet, pageBefore ?? pageWithout(sheet, "gone"));
  sheet.animate(
    [
      { ...shut, height: edge(style), marginTop: "0px", marginBottom: from, paddingTop: "0px", paddingBottom: "0px" },
      { ...shut, height: `${height}px`, marginTop, marginBottom, paddingTop, paddingBottom },
    ],
    { id: OPENING, duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  );
}

/** How far a piece of paper laid with openUp has opened, as it is drawn now: 0 shut, 1 open, and 1 once it is still. */
export function opened(sheet: HTMLElement) {
  const move = sheet.getAnimations().find((one) => one.id === OPENING);
  return move?.effect?.getComputedTiming().progress ?? 1;
}

/**
 * A page that gets shorter while someone is near its foot would be pulled up under their eyes by the
 * browser. So the page keeps the height that holds their place, and gives it back as soon as they
 * scroll up far enough not to need it.
 */
let letGo: (() => void) | undefined;
export function holdThePage() {
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

/**
 * For a sheet whose words have just changed under the same paper (a request that became "Paid" and lost its
 * buttons): it moves from the height it had to the height it has over the same 360ms. Call it before the
 * browser paints, with the height measured before the change. A plain cut for anyone who asks for less motion.
 */
export function settleFrom(sheet: HTMLElement, from: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const to = sheet.offsetHeight;
  if (to === from) return;
  holdThePage();
  // Getting shorter, the words already fit; getting taller, they are covered until the paper reaches them.
  const box = { boxSizing: "border-box", ...(to > from && { overflow: "hidden" }) };
  sheet.animate(
    [{ ...box, height: `${from}px` }, { ...box, height: `${to}px` }],
    { id: GROWING, duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  );
}

/** Undoes closeUp on a piece of paper that stays on the page for new words. */
function openFlat(sheet: HTMLElement) {
  if (!sheet.style.overflow && sheet.dataset.paperHeld === undefined) return;
  sheet.getAnimations().forEach((move) => move.cancel());
  if (sheet.dataset.paperHeld !== undefined) {
    Object.assign(sheet.style, { position: "", top: "", left: "", width: "", margin: "", zIndex: "", pointerEvents: "", visibility: "", animation: "" });
    delete sheet.dataset.paperHeld;
  }
  sheet.style.overflow = "";
  sheet.style.boxSizing = "";
  delete sheet.dataset.paperClosing;
}

const never = Symbol("never");

/**
 * One polite region for the whole page, there before anything is said in it: a line that is drawn already
 * holding its words is not read out by every screen reader, a change inside a waiting region is.
 */
function spokenPlace() {
  const kept = document.getElementById("live-spoken");
  if (kept) return kept;
  const place = document.createElement("div");
  place.id = "live-spoken";
  place.className = "sr-only";
  place.setAttribute("role", "status");
  place.setAttribute("aria-live", "polite");
  place.setAttribute("aria-atomic", "true");
  return document.body.appendChild(place);
}
/** The shell calls this once it is drawn, so the region is waiting long before the first saved line. */
export const readyToSpeak = () => void spokenPlace();
/** Says a line to a screen reader without moving focus. The same words said twice are spoken twice. */
export function speak(words: string) {
  const place = spokenPlace();
  place.textContent = "";
  window.setTimeout(() => (place.textContent = words), 120);
}

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
  // Spoken as well as seen. A line that takes focus is read by that; the others are said in the page's polite region.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = line.current;
      if (!now || now === document.activeElement) return;
      speak(typeof of === "string" ? of : (now.textContent ?? ""));
    });
    return () => cancelAnimationFrame(frame);
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

/**
 * For a box that gets a little taller when a live record lands in it (a ledger with one more row): it grows
 * into its new height over the same 360ms, so the page under it is moved and never jumps. It is measured after
 * every render and before the browser paints, so the new row is never seen at full height first. Only a small
 * growth at the same width counts; a filter, a new page of rows or a turned phone are left alone.
 */
export function useGrowsSmoothly(box: RefObject<HTMLElement | null>) {
  const was = useRef<{ width: number; height: number }>(undefined);
  useLayoutEffect(() => {
    const paper = box.current;
    if (!paper) return;
    // While it grows, what can be measured is the height it is passing through; the end is already kept.
    if (paper.getAnimations().some((move) => move.id === GROWING)) return;
    const before = was.current;
    const now = { width: paper.offsetWidth, height: paper.offsetHeight };
    was.current = now;
    const grown = before && now.width === before.width ? now.height - before.height : 0;
    if (!before || grown <= 0 || grown > 200 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    holdThePage();
    paper.animate(
      [{ height: `${before.height}px`, overflow: "hidden" }, { height: `${now.height}px`, overflow: "hidden" }],
      { id: GROWING, duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  });
}
