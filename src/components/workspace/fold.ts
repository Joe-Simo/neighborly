import { lessMotion } from "@/lib/less-motion";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { EASE_PAPER, EASE_PAPER_LEAVE } from "@/lib/motion";

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
 * After the hold, whatever is marked `data-fold-leaves` goes: it closes up over 360ms, its words at full ink, then is cut away, so what
 * is below glides into its place and the page never jumps. Await it, then take the sheet out of the data.
 * For anyone who asks for less motion it is a plain cut.
 * Every sheet is measured first, in one pass with the openings set to their end once, and only then does
 * any of them start to move: the page is laid out for the measures, never once per sheet between moves.
 */
export async function foldLeaves() {
  if (lessMotion()) return;
  const sheets = [...document.querySelectorAll<HTMLElement>("[data-fold-leaves]")];
  if (!sheets.length) return;
  const top = viewTop();
  const plans = onceOpened(() => sheets.map((sheet) => planClose(sheet, "gone", top)));
  await Promise.all(plans.map(runClose));
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

/**
 * The openings under way, kept here as they start: asking the document for its animations would make the browser
 * work out every style on the page first, inside the press.
 */
const openings = new Map<HTMLElement, Animation>();
function openingOf(sheet: HTMLElement) {
  const move = openings.get(sheet);
  if (move && (move.playState === "finished" || move.playState === "idle")) openings.delete(sheet);
  return openings.get(sheet);
}

/** Measures with every opening that is under way set to its end: the page as it will be once they are done. */
function onceOpened<T>(measure: () => T) {
  const moves = [...openings.keys()].flatMap((sheet) => openingOf(sheet) ?? []);
  const at = moves.map((move) => move.currentTime);
  moves.forEach((move) => (move.currentTime = LEAVE));
  const found = measure();
  moves.forEach((move, index) => (move.currentTime = at[index]));
  return found;
}

type Plan = {
  sheet: HTMLElement;
  /** A line held under the top edge has no room in the page: it slides away, whole, and nothing else is read. */
  held: boolean;
  from?: Keyframe;
  to?: Keyframe;
  lost?: number;
  unseen?: boolean;
  carried?: boolean;
  anchored?: boolean;
};

/** Everything the close needs read from the page, read once, before anything moves. */
function planClose(sheet: HTMLElement, after: "gone" | "put away", top: number): Plan {
  // Its own arriving moves are over for good; being measured must not start them again.
  sheet.dataset.paperClosing = "";
  if (sheet.dataset.paperHeld !== undefined) return { sheet, held: true };
  const style = getComputedStyle(sheet);
  const { marginTop, marginBottom, paddingTop, paddingBottom } = style;
  const height = sheet.offsetHeight;
  sheet.style.boxSizing = "border-box";
  // Cut off only below, as it closes: a corner standing past its top or side edge (and its shade) is never
  // clipped, so its edge is drawn the same on the last frame as on the first. flow-root keeps the hidden
  // overflow's own margin rule, so nothing inside moves when the close begins.
  if (style.display === "block") sheet.style.display = "flow-root";
  sheet.style.clipPath = "inset(-24px -24px 0 -24px)";
  holdThePage();
  // Where the close must end: the page without this paper, and with whatever is opening beside it open.
  const page = document.body.offsetHeight;
  const without = pageWithout(sheet, after);
  const closed = closedMargin(sheet, without);
  // Wholly above the window nobody sees it go, so it goes at once and what the person is looking at stays
  // where it is. Browsers that anchor the scroll do that themselves; the others are told.
  const unseen = home(sheet).bottom <= top;
  return {
    sheet,
    held: false,
    from: { height: `${height}px`, minHeight: "0px", marginTop, marginBottom, paddingTop, paddingBottom },
    to: { height: edge(style), minHeight: "0px", marginTop: "0px", marginBottom: closed, paddingTop: "0px", paddingBottom: "0px" },
    lost: page - without,
    unseen,
    // A saved line whose place is above the window is held in view under the top edge (paper.css). The person
    // does see that one go: it goes where it is, in one cut, and only then is its room above the window given up, at once.
    carried: unseen && sheet.getBoundingClientRect().bottom > top,
    anchored: unseen && anchored(sheet),
  };
}

const fade = EASE_PAPER_LEAVE;

async function runClose({ sheet, held, from, to, lost = 0, unseen, carried, anchored: kept }: Plan) {
  if (held) {
    // It lies over the page, so it is never see-through: it slides back up under the top edge, whole.
    await sheet.animate([{ transform: "none" }, { transform: HELD_AWAY }], { duration: LEAVE, fill: "forwards", easing: fade }).finished;
    sheet.style.visibility = "hidden";
    sheet.style.pointerEvents = "none";
    return;
  }
  // Taken away as the fade used to leave it (see-through, still read by screen readers where it is "put away"), but in one cut.
  if (carried) sheet.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });
  if (unseen && !kept) window.scrollBy(0, -lost);
  const timing = { duration: unseen ? 0 : LEAVE, fill: "forwards" } as const;
  // The paper closes up with its words on it at full ink, cut off below as it goes; never faded. Once closed it is taken away in one cut.
  await sheet.animate([from!, to!], { ...timing, easing: EASE_PAPER }).finished;
  sheet.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });
}

/**
 * One piece of paper closes up over 360ms, its words at full ink, and is then cut away, ending at exactly the height the page will have
 * without it; a plain cut for anyone who asks for less motion. `after` says what the room does with it next:
 * takes it out ("gone"), or keeps its words for screen readers only ("put away").
 */
export async function closeUp(sheet: HTMLElement, after: "gone" | "put away" = "gone") {
  if (lessMotion()) return;
  const top = viewTop();
  await runClose(onceOpened(() => planClose(sheet, after, top)));
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
export function openUp(sheet: HTMLElement, { stays = false }: { stays?: boolean } = {}) {
  // A piece that stays for as long as it is true (no connection, a refusal) is never held over the page: laid above
  // the window, it takes its place in the page at once and the window is moved down by its room, so what the
  // person is looking at keeps still and the piece is where it belongs when they go back up. For less motion too.
  if (stays && heldWhenLaid(sheet)) {
    window.scrollBy({ top: document.body.offsetHeight - pageWithout(sheet, "put away"), behavior: "instant" });
    return;
  }
  if (lessMotion()) return;
  // Asked twice, it opens once: an opening already under way is dropped before the paper is measured.
  openingOf(sheet)?.cancel();
  openings.delete(sheet);
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
    sheet.animate([{ transform: HELD_AWAY }, { transform: "none" }], { duration: LEAVE, easing: EASE_PAPER });
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
  if (lessMotion()) return;
  if (home(going).bottom > viewTop()) return openRoom(sheet);
  if (!anchored(sheet)) window.scrollBy(0, document.body.offsetHeight - pageWithout(sheet, "gone"));
}

/** Two margins that meet fold into one: the largest above nothing plus the most negative. */
function fold2(one: number, other: number) {
  return Math.max(one, other, 0) + Math.min(one, other, 0);
}

/**
 * The nearest neighbour that takes part in the page's flow, passing over what is drawn out of it (a line kept only
 * for screen readers, a hidden piece), whose margins meet nothing. Null where margins could meet something else.
 */
function inFlow(sheet: HTMLElement, way: "previousElementSibling" | "nextElementSibling") {
  for (let element = sheet[way]; element; element = element[way]) {
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.position === "absolute" || style.position === "fixed") continue;
    if (style.display === "contents" || style.float !== "none") return null;
    return style;
  }
  return null;
}

/**
 * The same margin closedMargin finds, worked out from the styles alone, with no page laid out to try it on: for a
 * sheet between two neighbours in a plain column, where what folds is only its margins and theirs. Anywhere else
 * (first or last in its column, a flex or grid column, a neighbour out of the flow) it says nothing, and the
 * margin is found by trying, as before.
 */
function foldedMargin(sheet: HTMLElement, style: CSSStyleDeclaration) {
  // A dialog's paper is drawn over the page, not in it: the page is as tall with the sheet as without, so trying
  // always ends at once on no margin. It is said here without laying the page out to find it.
  if (sheet.closest('[role="dialog"]')) return "0px";
  const column = sheet.parentElement;
  // Relative or sticky, it is laid out as if static: only what is drawn out of the flow is refused.
  if (!column || /^(abs|fix)/.test(style.position) || style.float !== "none") return null;
  const flow = getComputedStyle(column).display;
  if (flow !== "block" && flow !== "flow-root") return null;
  const below = inFlow(sheet, "nextElementSibling");
  // First in its column, over a neighbour with no top margin: what the column's top folds with is the same with the
  // sheet as without, so it is worked out as a neighbour above with none (a green line at the head of a room).
  const above = sheet.previousElementSibling ? inFlow(sheet, "previousElementSibling") : below?.marginTop == "0px" ? below : null;
  if (!above || !below) return null;
  const up = above == below ? 0 : parseFloat(above.marginBottom);
  const down = parseFloat(below.marginTop);
  // Without the sheet its neighbours' margins fold together; shut, it keeps its borders and holds them apart.
  const wanted = fold2(up, down) - fold2(up, 0) - parseFloat(edge(style));
  const margin = down >= 0 == wanted > down ? wanted : wanted - down;
  return `${Math.round(margin * 100) / 100}px`;
}

/** Opens the room of a piece of paper just laid in the page, from exactly the page as it was without it. */
function openRoom(sheet: HTMLElement) {
  const style = getComputedStyle(sheet);
  const { marginTop, marginBottom, paddingTop, paddingBottom } = style;
  const height = sheet.offsetHeight;
  holdThePage();
  const shut = { overflow: "hidden", boxSizing: "border-box", minHeight: "0px" };
  const from = pageBefore !== undefined ? closedMargin(sheet, pageBefore) : (foldedMargin(sheet, style) ?? closedMargin(sheet, pageWithout(sheet, "gone")));
  // A line held over the page as it scrolls (sticky) is drawn whole from its first frame, its paper over what is
  // under it, and only its room opens, below it: grown a frame at a time, the page under it showed through its band.
  const whole = style.position == "sticky";
  const move = sheet.animate(
    [
      whole
        ? { marginTop: "0px", marginBottom: `${parseFloat(from) - height + parseFloat(edge(style))}px` }
        : { ...shut, height: edge(style), marginTop: "0px", marginBottom: from, paddingTop: "0px", paddingBottom: "0px" },
      whole ? { marginTop, marginBottom } : { ...shut, height: `${height}px`, marginTop, marginBottom, paddingTop, paddingBottom },
    ],
    { id: OPENING, duration: LEAVE, easing: EASE_PAPER },
  );
  openings.set(sheet, move);
  const done = () => openings.get(sheet) === move && openings.delete(sheet);
  move.finished.then(done, done);
}

/** How far a piece of paper laid with openUp has opened, as it is drawn now: 0 shut, 1 open, and 1 once it is still. */
export function opened(sheet: HTMLElement) {
  const move = openingOf(sheet);
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

/** Undoes closeUp on a piece of paper that stays on the page for new words. */
function openFlat(sheet: HTMLElement) {
  if (!sheet.style.clipPath && sheet.dataset.paperHeld === undefined) return;
  sheet.getAnimations().forEach((move) => move.cancel());
  if (sheet.dataset.paperHeld !== undefined) {
    Object.assign(sheet.style, { position: "", top: "", left: "", width: "", margin: "", zIndex: "", pointerEvents: "", visibility: "", animation: "" });
    delete sheet.dataset.paperHeld;
  }
  sheet.style.clipPath = "";
  sheet.style.display = "";
  sheet.style.boxSizing = "";
  delete sheet.dataset.paperClosing;
}

const never = Symbol("never");
/** How long a saved line stands: six seconds, ten when it carries a way back. */
export const lineStay = (action: boolean) => (action ? 10000 : 6000);

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
/**
 * Says a line to a screen reader without moving focus. The same words said twice are spoken twice.
 * `unless` is asked again as the words go out: a line that has taken focus by then is read by that, not twice.
 */
export function speak(words: string, unless?: () => boolean) {
  const place = spokenPlace();
  place.textContent = "";
  window.setTimeout(() => {
    if (!unless?.()) place.textContent = words;
  }, 120);
}

/** What each saved line said when it took focus: every saying takes focus once. */
const focusTaken = new Set<unknown>();
/**
 * A saved line that tells a screen reader by taking focus takes it once, when it is first said and focus is free.
 * Drawn again, or drawn as a sheet closes, it leaves focus where it is: a closing sheet hands it back to its opener.
 * Where it does not take focus it is still said, in the page's polite region (useSavedLine).
 */
export function useFocusOnce(line: RefObject<HTMLElement | null>, saying: unknown) {
  useEffect(() => {
    if (focusTaken.has(saying)) return;
    // After a closing sheet has handed focus back to its opener (live-dialog.tsx): the line takes focus only where
    // focus has nowhere to be, as when the control that was pressed has left with the step it took.
    // Watched for a second, not one frame: a sheet still closing holds focus, and only once it has handed focus back
    // is it known whether its opener is still there. If the opener left with the step (a paid request's sheet), focus
    // would fall to the page; the line takes it instead.
    let frame = 0, left = 60;
    const look = () => {
      const now = document.activeElement;
      if (now && now !== document.body) {
        if (!now.closest('[role="dialog"]') || left-- <= 0) return;
        frame = requestAnimationFrame(look);
        return;
      }
      focusTaken.add(saying);
      // Focus tells a screen reader; it must not pull the page away from where the sheet was.
      line.current?.focus({ preventScroll: true });
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [line, saying]);
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
  {
    action = false,
    of,
    remaining,
  }: {
    action?: boolean;
    of?: unknown;
    /** A line put back when the person returns to its room within its time: it stands whole for what is left, unsaid. */
    remaining?: number;
  } = {},
) {
  const [left, setLeft] = useState<unknown>(never);
  const back = remaining !== undefined;
  // Before it is first painted, the line opens its own room; one that closed up before is opened flat first.
  useLayoutEffect(() => {
    if (!line.current || back) return;
    openFlat(line.current);
    openUp(line.current);
    // Whether the line is new or put back is fixed when it is laid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, of]);
  // Spoken as well as seen. A line that takes focus is read by that; the others are said in the page's polite region.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = line.current;
      if (back) return;
      // Focus can reach the line a moment after it is drawn (the room puts it there once the save is answered).
      const focused = () => !!now && (now === document.activeElement || now.contains(document.activeElement));
      if (!now || focused()) return;
      speak(typeof of === "string" ? of : (now.textContent ?? ""), focused);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, of]);
  useEffect(() => {
    const stay = remaining ?? lineStay(action);
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
  }, [line, action, of, remaining]);
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
  // Its own growing, kept here: asking the page what moves would make it work out every style in the room first.
  const growing = useRef<Animation>(undefined);
  // A room put out of sight and shown again (shell.tsx keeps rooms built) is a box laid anew: nothing to grow from.
  useLayoutEffect(() => () => void (was.current = undefined), []);
  useLayoutEffect(() => {
    const paper = box.current;
    if (!paper) return;
    // A box just laid has nothing to grow from: its first height is taken once the frame is laid out, so a room
    // arriving is not measured in the middle of being drawn.
    if (!was.current) {
      const first = requestAnimationFrame(() => {
        was.current ??= { width: paper.offsetWidth, height: paper.offsetHeight };
      });
      return () => cancelAnimationFrame(first);
    }
    // While it grows, what can be measured is the height it is passing through; the end is already kept.
    if (growing.current?.playState === "running") return;
    const before = was.current;
    const now = { width: paper.offsetWidth, height: paper.offsetHeight };
    was.current = now;
    const grown = now.width === before.width ? now.height - before.height : 0;
    if (grown <= 0 || grown > 200 || lessMotion()) return;
    holdThePage();
    growing.current = paper.animate(
      [{ height: `${before.height}px`, overflow: "hidden" }, { height: `${now.height}px`, overflow: "hidden" }],
      { id: GROWING, duration: LEAVE, easing: EASE_PAPER },
    );
  });
}

/**
 * A room's saved line, held while the person steps into another room: back within its time, the line and its way
 * back are there again for what is left of it, without a second saying or a move. One per room; the newest wins.
 */
const keptLines = new Map<string, { value: unknown; until: number }>();
/** Puts the room's line by as the room is left, when it still has time to stand. */
function keepLine(room: string, value: unknown, since: number, action: boolean) {
  const until = since + lineStay(action);
  if (until - Date.now() > 500) keptLines.set(room, { value, until });
}
/** Takes the room's line back as the room is entered again, with the time it has left; nothing once that has passed. */
export function takeLine<T>(room: string): { value: T; remaining: number } | undefined {
  const kept = keptLines.get(room);
  keptLines.delete(room);
  const remaining = kept ? kept.until - Date.now() : 0;
  return kept && remaining > 500 ? { value: kept.value as T, remaining } : undefined;
}

/**
 * A room's line with a way back, kept across a step into another room. `line` is what the room shows now (undefined
 * when it shows none); `restored` is what the room took back with takeLine as it was entered (read once, into its state).
 */
export function useKeptLine<T>(room: string, line: T | undefined, restored: { value: T; remaining: number } | undefined) {
  // When the line now shown was put up: a restored one keeps the moment it first went up.
  const since = useRef(0);
  const kept = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (line !== undefined && restored && same(line, restored.value)) since.current ||= Date.now() + restored.remaining - lineStay(true);
    else if (line !== undefined && !(kept.current !== undefined && same(line, kept.current))) since.current = Date.now();
    kept.current = line;
  }, [line, restored]);
  useEffect(() => () => void (kept.current !== undefined && keepLine(room, kept.current, since.current, true)), [room]);
}
/** The same line: the same parts, each the same thing (a line is rebuilt from its parts on each drawing). */
const same = (one: unknown, other: unknown) =>
  one === other ||
  (typeof one === "object" && typeof other === "object" && one !== null && other !== null &&
    Object.keys(one).length === Object.keys(other).length &&
    Object.entries(one).every(([key, part]) => (other as Record<string, unknown>)[key] === part));
