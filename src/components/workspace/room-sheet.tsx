"use client";

import { Component, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ROOM_WHOLE } from "@/lib/room-whole";
import { whenIdle } from "@/lib/idle";
import { flushSync } from "react-dom";
import { edgeTurn, roomTurn, type RoomTurn } from "@/components/workspace/room-turn";
import { drawn as drawnPart, markWayBack } from "@/components/workspace/record-slide";
import { useConvex, useConvexConnectionState } from "convex/react";

/**
 * A room is drawn whole or not at all. When the room changes, a still copy of the column just left (its head,
 * picture, button, rows and side column, exactly as they stood) lies over the page while the next room is drawn
 * unseen beneath it. The moment the next room is whole the copy goes and the room is there, in one frame.
 * A room that is not whole by HOLD gives the column to the one quiet "Opening…" line, where its title will be.
 * A fresh page has no room to hold: its wait carries on from the launch screen's, whose line stands in the same place.
 */

export { ROOM_WHOLE };

/** The longest the last room is held while the next is not yet whole. */
const HOLD = 400;
/**
 * A room that never says it is whole is shown as it stands after this long: it is never kept from the reader.
 * Time without a connection is not counted. A room opened with no connection cannot become whole (its questions are
 * not answered until the connection returns), and shown as it stands it would be half a room; so it waits, the line
 * names the connection (`lost`), and the count starts again when the connection is back.
 */
const LONGEST = 8000;
/** How long the connection must be down before the waiting line says so: a blink is never named (as states.tsx). */
const LOST = 2000;

/**
 * How far down the sheet reaches: to the window's foot, or to the phone's bottom bar, which stays put above it,
 * so the corner that lifts first is in view from the turn's first frame.
 */
const sheetHeight = (top: number) => {
  // While the Menu is open the bar is put away, and it is back at the foot once the menu goes: it is measured as it will
  // stand then. Where the shell has no bar (wider screens, the web), there is none to measure.
  const bar = document.querySelector<HTMLElement>(".live-tab-bar");
  let tall = bar?.offsetHeight ?? 0;
  const shown = document.documentElement.dataset.shell === "ios" && matchMedia("(max-width: 699px)").matches;
  if (bar && !tall && shown && document.body.hasAttribute("data-scroll-locked")) {
    bar.style.setProperty("display", "grid");
    tall = bar.offsetHeight;
    bar.style.removeProperty("display");
  }
  return Math.max(0, window.innerHeight - tall - top);
};

/** The still copy of the column just left, while it lies on the page. */
let still: HTMLElement | null = null;
/** That copy, laid ready to be turned: built as the copy is laid, so the turn's first frame only moves paper. */
let turning: RoomTurn | null = null;
const letGo = () => {
  turning?.end();
  still?.remove();
  turning = null;
  still = null;
};

/**
 * A step back to the last room taken by the finger, from the left edge (useEdgeTurn): the finger holds the turn
 * instead of the turn playing by itself. `progress` is where the finger is (0 to 1 across the column); `asked` is what
 * it chose on letting go (on to the room before, or back to the room it was on). `undoing` is a step back laid down
 * again: the room it left is coming back beneath the sheet, and the sheet then goes in one cut.
 */
const finger: { on: boolean; progress: number; asked: "on" | "back" | null; turn: RoomTurn | null; undoing: boolean; record: boolean } = {
  record: false,
  on: false,
  progress: 0,
  asked: null,
  turn: null,
  undoing: false,
};

/**
 * The room the menus name as current while a finger holds a step back: the room being left, until the turn carries
 * on to the room before and is done; then the menus move to it in that same frame. A page laid back never moves them.
 */
let heldArea: string | null = null;
const heldListeners = new Set<() => void>();
function holdArea(area: string | null) {
  if (heldArea === area) return;
  heldArea = area;
  flushSync(() => heldListeners.forEach((listener) => listener()));
}
const watchHeld = (changed: () => void) => {
  heldListeners.add(changed);
  return () => heldListeners.delete(changed);
};
/** The room the side column and the bar name as current: the shown one, or the one a held step back is leaving. */
export function useMenuArea(area: string) {
  return useSyncExternalStore(watchHeld, () => heldArea, () => null) ?? area;
}

type Felt = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: "turned") => void } } } };
/** A page turn that commits is felt once, softly, in the iOS app; one laid back down is not. */
const feelTurn = () => (window as Felt).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("turned");

/** The finger has let go and the room before is whole: the turn is carried on, or laid back down and the step undone. */
function letFingerGo() {
  const turn = finger.turn;
  const asked = finger.asked;
  if (!turn || !asked) return;
  finger.on = false;
  finger.turn = null;
  finger.asked = null;
  if (asked === "on") {
    feelTurn();
    finger.record = false;
    void turn.glide(finger.progress, 1).then(() => holdArea(null));
    return;
  }
  if (finger.record) {
    // A record's page laid back down: the record comes back beneath it, and the sheet goes in one cut once it is drawn.
    finger.record = false;
    void turn
      .glide(finger.progress, 0)
      .then(() => {
        window.history.forward();
        return drawnPart("record");
      })
      .then(() => {
        turn.end();
        holdArea(null);
      });
    return;
  }
  void turn.glide(finger.progress, 0).then(() => {
    // The sheet lies flat again over the room before. The step is undone beneath it: the room it shows comes back
    // under it unseen (the sheet already lying there stays, as any sheet does), and it is let go of in one cut.
    turning = turn;
    still = document.createElement("div");
    finger.undoing = true;
    window.history.forward();
  });
}

/**
 * A room that took long enough to say "Opening…" has no sheet of the last room left lying over it: the page it is
 * turned from is the one the reader was looking at, bare paper with that one line where the title will be.
 */
function openingSheet(column: HTMLElement, line: HTMLElement) {
  const place = column.getBoundingClientRect();
  const at = line.getBoundingClientRect();
  const sheet = document.createElement("div");
  sheet.setAttribute("data-room-still", "");
  Object.assign(sheet.style, { position: "fixed", top: `${place.top}px`, left: `${place.left}px`, width: `${place.width}px`, height: `${sheetHeight(place.top)}px`, overflow: "hidden", zIndex: "19", pointerEvents: "none" });
  const copy = line.cloneNode(true) as HTMLElement;
  copy.removeAttribute("role");
  // The line as it was set: its words' own style, at its own place on the sheet, still (its arrival is long over).
  const style = getComputedStyle(line);
  for (const property of style) copy.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(copy.style, { position: "absolute", top: `${at.top - place.top}px`, left: `${at.left - place.left}px`, margin: "0", animation: "none" });
  sheet.append(copy);
  const frame = document.createElement("div");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("inert", "");
  frame.append(sheet);
  return { sheet, frame };
}

/**
 * The room beneath is whole: the sheet lying over it is turned away (room-turn.ts). With less motion asked for, or with
 * no sheet lying there, it is one cut. The sheet is let go of at once, so a next room change starts from a clear page.
 */
function turnAway(opening: ReturnType<typeof openingSheet> | null) {
  const laid = turning;
  turning = null;
  still = null;
  const turn = laid ?? (opening ? (finger.on ? edgeTurn : roomTurn)(opening.sheet, opening.frame) : null);
  if (!turn) return;
  // The room a step back was undone to is whole beneath the sheet that shows it: the sheet goes in one cut.
  if (finger.undoing) {
    finger.undoing = false;
    holdArea(null);
    return turn.end();
  }
  // A finger holds this turn: it is laid where the finger is, and carried on or back once the finger lets go.
  if (finger.on) {
    finger.turn = turn;
    turn.drive(finger.progress);
    letFingerGo();
    return;
  }
  // A room picked from the Menu: the menu and its shade, still on their way out, are taken away in this one frame,
  // so the page turned is the page seen clearly, never one under a shade.
  for (const closing of document.querySelectorAll<HTMLElement>('[data-slot="dialog-overlay"][data-state="closed"], [data-slot="dialog-content"][data-state="closed"]')) {
    closing.style.visibility = "hidden";
    for (const move of closing.getAnimations()) move.finish();
  }
  feelTurn();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return turn.end();
  void turn.play();
}

/** The properties a move can be holding at a value of its own, read off the page and written onto the copy. */
const HELD = ["opacity", "transform", "translate", "rotate", "scale", "visibility", "clip-path", "filter", "background-size", "box-shadow"];

/**
 * A picture in the copy, painted from the very picture on screen. A copied <img> picks its source and loads it
 * again, even from the cache, and is blank for the copy's first frame; a canvas drawn from the shown one is not.
 */
/** The size a picture's copy is painted at: its box on this screen's pixels, never above the picture's own. */
function stillSize(shown: HTMLImageElement) {
  const box = shown.getBoundingClientRect();
  const seen = Math.max(box.width / shown.naturalWidth, box.height / shown.naturalHeight) * (window.devicePixelRatio || 1);
  const scale = Math.min(1, seen || 1);
  return { width: Math.max(1, Math.round(shown.naturalWidth * scale)), height: Math.max(1, Math.round(shown.naturalHeight * scale)) };
}

/**
 * A room's pictures, decoded ahead at the size their copy is painted at, once the room is at rest: drawing a picture
 * that is not yet decoded makes the press wait while it is decoded, in the very frame the next room arrives.
 */
const decoded = new WeakMap<HTMLImageElement, { src: string; width: number; height: number; bitmap: ImageBitmap }>();
function decodeAhead(column: HTMLElement) {
  for (const picture of column.querySelectorAll("img")) {
    if (!picture.complete || !picture.naturalWidth) continue;
    const size = stillSize(picture);
    const kept = decoded.get(picture);
    if (kept && kept.src === picture.currentSrc && kept.width === size.width && kept.height === size.height) continue;
    const src = picture.currentSrc;
    void createImageBitmap(picture, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "high" })
      .then((bitmap) => {
        decoded.get(picture)?.bitmap.close();
        decoded.set(picture, { src, ...size, bitmap });
      })
      .catch(() => undefined);
  }
}

/**
 * A picture in the copy, painted from the very picture on screen. A copied <img> picks its source and loads it
 * again, even from the cache, and is blank for the copy's first frame; a canvas drawn from the shown one is not.
 */
function stillPicture(shown: HTMLImageElement, twin: HTMLImageElement) {
  if (!shown.complete || !shown.naturalWidth) return;
  const canvas = document.createElement("canvas");
  // Painted at the size it is seen at (its box on this screen's pixels), never above the picture's own: a copy at
  // full size on a phone's screen is many times the pixels anyone sees, and the press waits on every one of them.
  const size = stillSize(shown);
  canvas.width = size.width;
  canvas.height = size.height;
  const kept = decoded.get(shown);
  const ahead = kept && kept.src === shown.currentSrc && kept.width === size.width && kept.height === size.height ? kept.bitmap : null;
  canvas.getContext("2d")?.drawImage(ahead ?? shown, 0, 0, canvas.width, canvas.height);
  // Laid out and fitted exactly as the picture was: its box, its fit and its focus.
  const style = getComputedStyle(shown);
  for (const property of style) canvas.style.setProperty(property, style.getPropertyValue(property));
  canvas.dataset.picture = shown.currentSrc;
  twin.replaceWith(canvas);
}

/**
 * The column as it stands, as a copy that cannot move: every move in it is stopped where it is, so a row that was
 * rising stays where it was seen and a picture's piece stays where it was set down. Its ids are dropped (they
 * stay the room's own) and nothing in it can be reached, by a pointer or a screen reader.
 */
function stillCopy(column: HTMLElement) {
  const copy = column.cloneNode(true) as HTMLElement;
  const from = [column, ...column.querySelectorAll<HTMLElement>("*")];
  const to = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
  // What lies wholly below the screen is never seen on the sheet (the sheet is cut at the screen's foot), so it is
  // left out of the copy, whole branches at a time: the press then waits only on what can be seen.
  const foot = window.innerHeight;
  const gone = new Set<Element>();
  from.forEach((element, index) => {
    if (index === 0) return;
    if (gone.has(element.parentElement as Element)) return gone.add(element);
    if (element.getBoundingClientRect().top > foot && getComputedStyle(element).position === "static") {
      gone.add(element);
      to[index].remove();
    }
  });
  const moving = new Set(column.getAnimations({ subtree: true }).map((move) => (move.effect instanceof KeyframeEffect ? move.effect.target : null)));
  from.forEach((element, index) => {
    if (gone.has(element)) return;
    const twin = to[index];
    if (moving.has(element)) {
      const style = getComputedStyle(element);
      for (const property of HELD) twin.style.setProperty(property, style.getPropertyValue(property));
    }
    // What was typed in a box is its value, not its attribute, and a copy carries only the attribute.
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
      (twin as typeof element).value = element.value;
    twin.removeAttribute("id");
    if (element instanceof HTMLImageElement) stillPicture(element, twin as HTMLImageElement);
  });
  copy.removeAttribute("data-room-held");
  copy.setAttribute("data-room-still", "");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  return copy;
}

/** What the room's frame says about the room in it, which its twin around the copy does not say. */
const LIVE = ["id", "data-room-whole", "data-room-shown", "data-room-in", "data-room-held"];

/**
 * The frame the copy lies in: a bare twin of each element the column stands in, up to the page's body. A rule that
 * looks up to the room's frame (`.live-app:has(…)`) sees in it only the room just left, never the next room drawn
 * unseen in the real frame. The twins draw nothing of their own and take no room: the copy lies where the column lies.
 */
function stillFrame(column: HTMLElement, copy: HTMLElement) {
  let frame = copy;
  for (let up = column.parentElement; up && up !== document.body; up = up.parentElement) {
    const twin = up.cloneNode(false) as HTMLElement;
    for (const name of LIVE) twin.removeAttribute(name);
    twin.setAttribute("data-room-frame", "");
    twin.style.setProperty("display", "contents", "important");
    twin.append(frame);
    frame = twin;
  }
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("inert", "");
  return frame;
}

/**
 * The copy, taken ahead while the room is at rest and nothing is asked of the page, so the frame that changes room
 * only lays it down. It stands for the room exactly as it is: any change in the room, a scroll, a resize or a
 * typed letter puts it aside, and it is taken again once the page is quiet. Without one, the copy is taken then.
 */
let ready: { column: HTMLElement; copy: HTMLElement; y: number; width: number; height: number } | null = null;
function keepReady(column: HTMLElement) {
  let cancel = () => {};
  let settle = 0, waiting = false;
  const take = () => {
    waiting = false;
    cancel();
    cancel = whenIdle(() => {
      if (!column.isConnected || column.hasAttribute("data-room-held") || still) return;
      // Not while a sheet lies over the room: the copy would be taken in the middle of the sheet's own frames, and
      // the room cannot be left from under it. Closing the sheet changes the room again, which takes it then.
      if (document.querySelector('[role="dialog"][data-state="open"]')) { waiting = true; return; }
      ready = { column, copy: stillCopy(column), y: window.scrollY, width: window.innerWidth, height: window.innerHeight };
    }, 1500);
  };
  const stale = () => {
    if (ready?.column === column) ready = null;
    cancel();
    window.clearTimeout(settle);
    settle = window.setTimeout(take, 200);
  };
  const changed = new MutationObserver(stale);
  changed.observe(column, { subtree: true, childList: true, attributes: true, characterData: true });
  window.addEventListener("scroll", stale, { passive: true });
  window.addEventListener("resize", stale);
  column.addEventListener("input", stale);
  // A sheet hands focus back as it closes: the room is at rest again, so the copy is taken then.
  const back = () => { if (waiting) stale(); };
  document.addEventListener("focusin", back);
  take();
  return () => {
    cancel();
    window.clearTimeout(settle);
    changed.disconnect();
    window.removeEventListener("scroll", stale);
    window.removeEventListener("resize", stale);
    column.removeEventListener("input", stale);
    document.removeEventListener("focusin", back);
    if (ready?.column === column) ready = null;
  };
}
/** The copy taken ahead, when it is still the room as it stands now. */
function readyCopy(column: HTMLElement) {
  const kept = ready;
  ready = null;
  const same = kept && kept.column === column && kept.y === window.scrollY && kept.width === window.innerWidth && kept.height === window.innerHeight;
  return same && !stillMoving(column).length ? kept.copy : stillCopy(column);
}

/** Lays the still copy over the column, where the column lies on the screen. */
function hold(column: HTMLElement | null) {
  // A room that was never shown is not copied: the copy already lying there, or the "Opening…" line, stays.
  if (!column || still || column.hasAttribute("data-room-held")) return;
  const place = column.getBoundingClientRect();
  const copy = readyCopy(column);
  Object.assign(copy.style, {
    position: "fixed",
    top: `${place.top}px`,
    left: `${place.left}px`,
    width: `${place.width}px`,
    height: `${sheetHeight(place.top)}px`,
    margin: "0",
    overflow: "hidden",
    zIndex: "19",
    pointerEvents: "none",
  });
  still = stillFrame(column, copy);
  document.body.append(still);
  // Taken back by the finger, the room before comes back over from the left; any other change turns the corner.
  turning = (finger.on ? edgeTurn : roomTurn)(copy, still);
}

/**
 * Takes the still copy in the commit that changes room, before React has changed anything on the page
 * (`getSnapshotBeforeUpdate` runs before any of the commit's changes are made), so the copy is the room as it was seen.
 */
export class RoomStill extends Component<{ area: string; column: RefObject<HTMLElement | null>; children: ReactNode }> {
  getSnapshotBeforeUpdate(previous: Readonly<{ area: string }>) {
    if (previous.area !== this.props.area) hold(this.props.column.current);
    return null;
  }
  componentDidUpdate() {}
  componentWillUnmount() {
    letGo();
  }
  render() {
    return this.props.children;
  }
}

/**
 * Everything the room is made of is in: its picture can be painted, its head button knows its style, its rows and
 * side column are drawn, no part of it is still on its way, and the page's faces are loaded.
 */
function isWhole(column: HTMLElement) {
  const room = column.querySelector(".live-room");
  if (!room?.querySelector(":scope > :not([hidden])")) return false;
  if (column.querySelector(".live-loading, .help-opening, [data-room-pending]")) return false;
  const art = column.querySelector(".live-head-art");
  if (art && !art.hasAttribute("data-ready")) return false;
  if (column.querySelector(".live-head-actions [data-unsettled]")) return false;
  return document.fonts.status === "loaded";
}

/**
 * The room shown has come to rest: nothing in it is still moving to its place (its picture's piece, a row easing in). What moves without end, if anything, does not count.
 */
function stillMoving(column: HTMLElement) {
  return column
    .getAnimations({ subtree: true })
    .filter((move) => move.playState === "running" && Number.isFinite(move.effect?.getComputedTiming().endTime));
}

/**
 * The launch screen's line on the page (`LiveRoomLoading`), whether it has been said, and when its wait began on the page's clock
 * (null while it has not begun or once it is said). It is read while the next screen is drawn, before the commit that takes the line away.
 */
function launchLine() {
  const line = typeof document === "undefined" ? null : document.querySelector(".paper-loading-label");
  if (!line) return null;
  const coming = line.getAnimations()[0];
  // No animation left on the line means it has been said. One that has not begun yet (a screen replaced within its
  // first frame) has no start time: that line is still to come, and is not taken for one already said.
  return { line, said: !coming, began: typeof coming?.startTime === "number" ? coming.startTime : null };
}

/**
 * A launch screen that takes another's place (the server's, then the app's own) carries its line on: said when the
 * one before would have said it, or at once if that one already had. A fresh page's wait is one line, never two.
 */
export function useLaunchCarried(own: RefObject<HTMLElement | null>) {
  const [before] = useState(launchLine);
  useLayoutEffect(() => {
    const line = own.current?.getAnimations()[0];
    // Carried on only from a line that went in this commit: one still on the page, or none, is not this screen's.
    if (!before || before.line.isConnected || !line) return;
    if (before.said) line.finish();
    else if (before.began !== null) line.startTime = before.began;
  }, [before, own]);
}

/** True once the room in view is drawn whole: what waits for the room to be seen (a figure's roll) starts then. */
const Shown = createContext(true);
export const RoomShown = Shown.Provider;
export function useRoomShown() {
  return useContext(Shown);
}

/**
 * Watches the room being opened, every frame, until it is whole, and then shows it: the copy of the last room goes,
 * the room is drawn, and whatever of its own arrival ran while it was unseen is finished, all before that frame is
 * painted. `shown` is the room in view; `opening` says the column has waited long enough to say "Opening…";
 * `lost` says that wait is for the connection, which has been down two seconds, so the line names it instead;
 * `settled` says the room shown has come to rest.
 */
export function useWholeRoom(area: string, column: RefObject<HTMLElement | null>) {
  // Asked of the client itself each frame, so the watch below never acts on a stale answer or starts over for a new one.
  const convex = useConvex();
  // For the words only: the connection has been down two seconds while a room is held, so the line can say so.
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const down = hasEverConnected && !isWebSocketConnected;
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLost(down), down ? LOST : 0);
    return () => clearTimeout(timer);
  }, [down]);
  const [shown, setShown] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  // The launch screen this workspace takes the place of, if one is on the page as it is first drawn.
  const [launch] = useState(launchLine);
  const held = shown !== area;
  const first = shown === null;
  useLayoutEffect(() => {
    if (!held) return;
    const began = performance.now();
    // The line is said 400ms into the wait: from now when the last room is held, or for the first room after a
    // launch screen, when that screen would have said it (at once if it already had).
    const carried = first && launch && !launch.line.isConnected ? launch : null;
    const quiet = carried ? (carried.said ? began : (carried.began ?? began) + HOLD) : began + HOLD;
    // A line already due is said in the room's very first frame. A frame's own time can be earlier than now (the
    // frame was begun while the room was being drawn), so waiting for one would leave the column bare for a frame.
    let said = began >= quiet;
    if (said) setOpening(true);
    // The longest wait is counted only while there is a connection: every frame without one starts it again.
    let counted = began;
    let frame = requestAnimationFrame(function look(now) {
      const element = column.current;
      const link = convex.connectionState();
      if (link.hasEverConnected && !link.isWebSocketConnected) counted = now;
      if (element && (isWhole(element) || now - counted >= LONGEST)) {
        // A page that said "Opening…" is taken as it stands, before the line leaves it, to be turned in its place.
        const line = said && !first && !still ? element.querySelector<HTMLElement>(".live-opening") : null;
        const opening = line && openingSheet(element, line);
        flushSync(() => {
          setShown(area);
          setOpening(false);
        });
        turnAway(opening);
        // The room was drawn unseen: its rows' own arrivals are for a room already on screen, so they are done, and
        // so is any easing of the room's coming into view (a button that eases all it changes would be a frame late).
        for (const move of element.getAnimations({ subtree: true }))
          if ((move instanceof CSSAnimation || move instanceof CSSTransition) && Number.isFinite(move.effect?.getComputedTiming().endTime)) move.finish();
        // Said to whatever lies over the room (the home page's card, card-offer-grow.tsx) in this same frame, before it
        // is painted: the room is whole now, and what covers it can leave now, with no frame spent looking for it.
        window.dispatchEvent(new Event(ROOM_WHOLE));
        return;
      }
      // The line is laid and the copy taken away in the same frame, so the column is never bare between them.
      if (!said && now >= quiet) {
        said = true;
        flushSync(() => setOpening(true));
        letGo();
      }
      frame = requestAnimationFrame(look);
    });
    return () => cancelAnimationFrame(frame);
  }, [area, held, first, launch, column, convex]);
  // Once shown, the room is watched until it is at rest: `settled` (data-room-whole) is the room as it will stay.
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const element = column.current;
    if (held || !element) return;
    // Asked once a frame at first, then only when what was moving has ended: asking the page what moves makes it
    // work out every style in the room, and asked on every frame of a turn that was most of the frame.
    const since = performance.now();
    let left = false;
    let frame = 0;
    const look = (now: number) => {
      if (left) return;
      const moving = stillMoving(element);
      if (!moving.length || now - since >= LONGEST) {
        // At rest, its pictures are decoded for the copy the next room change takes (stillPicture), off this thread.
        decodeAhead(element);
        return setSettled(area);
      }
      const ends = Promise.all(moving.map((move) => move.finished.catch(() => undefined)));
      const late = new Promise((go) => setTimeout(go, Math.max(0, LONGEST - (now - since))));
      void Promise.race([ends, late]).then(() => {
        if (!left) frame = requestAnimationFrame(look);
      });
    };
    frame = requestAnimationFrame(look);
    return () => {
      left = true;
      cancelAnimationFrame(frame);
    };
  }, [area, held, column]);
  // At rest, the copy the next room change lays down is taken ahead, and kept as the room it stands for.
  const atRest = !held && settled === area;
  useEffect(() => {
    const element = column.current;
    if (!atRest || !element) return;
    return keepReady(element);
  }, [atRest, column]);
  return { shown: !held, opening: held && opening, lost: held && opening && lost, settled: atRest };
}

type Edge = { webkit?: { messageHandlers?: { kindHelpsEdge?: { postMessage: (pageOwns: boolean) => void } } } };
/** How far in from the left edge a finger may land and still be taking the step back. */
const EDGE = 24;
/** Past this share of the column, or on a flick this fast (px per ms), a let-go turns the page; short of both, it lies back. */
const FAR_ENOUGH = 0.4;
const FLICK = 0.5;

/**
 * In the iOS app, the step back from a room to the room before is the page turn, held by the finger: a swipe in from
 * the left edge turns the room's sheet as far as the finger has come, and letting go carries it on past about 40%
 * (or on a flick) or lays it back down. The app's own swipe back (WebKit's) is put away while a room is shown and the
 * page takes the edge; inside a room (a record, a sheet) the app's own swipe is the step back, as before. No page is
 * ever turned under a sheet or dialog that is open: the edge is left to it.
 */
export function useEdgeTurn(inApp: boolean, inRoom: boolean, roomShown: boolean) {
  // Whether a step back may start: read at the touch, so a step already under way outlives the room change it makes.
  const startable = useRef(roomShown && inRoom);
  useEffect(() => {
    startable.current = roomShown && inRoom;
  }, [roomShown, inRoom]);
  // The edge is the page's for as long as a room is the page, held through the room change a step back makes: the
  // app's own swipe is never handed a finger already turning a page.
  useEffect(() => {
    (window as Edge).webkit?.messageHandlers?.kindHelpsEdge?.postMessage(inRoom);
  }, [inRoom]);
  useEffect(() => {
    const edge = (window as Edge).webkit?.messageHandlers?.kindHelpsEdge;
    if (!inApp || !edge) return;
    let start: { x: number; y: number; left: number; width: number } | null = null;
    let trail: { x: number; t: number }[] = [];
    let lost = 0;
    const covered = () => !!document.querySelector('[data-slot="dialog-content"][data-state="open"], .row-menu-shade, [data-vaul-drawer][data-state="open"]');
    const down = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!startable.current || event.touches.length !== 1 || touch.clientX > EDGE || finger.on || finger.undoing || covered() || window.history.length < 2) return;
      const column = document.querySelector<HTMLElement>(".live-app main.live-main");
      const box = column?.getBoundingClientRect();
      start = { x: touch.clientX, y: touch.clientY, left: box?.left ?? 0, width: box?.width ?? window.innerWidth };
      trail = [{ x: touch.clientX, t: event.timeStamp }];
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      if (!finger.on) {
        // A swipe that runs more down than across is a scroll, and is left to the page.
        if (Math.abs(touch.clientY - start.y) > Math.abs(dx)) start = null;
        if (!start || dx < 8) return;
        finger.on = true;
        finger.asked = null;
        holdArea(window.location.pathname.split("/")[2] ?? null);
        const column = document.querySelector<HTMLElement>(".live-app main.live-main");
        if (column && new URLSearchParams(window.location.search).has("neighbor")) {
          // Inside a record the room stays the same: the record's own page is laid and turned back over the list,
          // which comes back beneath it at its place (record-slide.tsx).
          finger.record = true;
          const turn = layBackSheet(column);
          markWayBack();
          window.history.back();
          void drawnPart("list")
            .then(() => new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled))))
            .then(() => {
              finger.turn = turn;
              turn.drive(finger.progress);
              letFingerGo();
            });
        } else window.history.back();
        // A step back that leads to no room (the way in, another page) brings no turn: the finger lets it be.
        window.clearTimeout(lost);
        lost = window.setTimeout(() => {
          if (!finger.on || finger.turn) return;
          Object.assign(finger, { on: false, asked: null });
          holdArea(null);
        }, 1500);
      }
      event.preventDefault();
      // Measured from the column's own left edge, so the crease is where the finger is, never behind it.
      finger.progress = Math.min(1, Math.max(0, (touch.clientX - start.left) / start.width));
      trail = [...trail.filter((point) => event.timeStamp - point.t < 80), { x: touch.clientX, t: event.timeStamp }];
      finger.turn?.drive(finger.progress);
    };
    const up = (event: TouchEvent) => {
      if (!start) return;
      start = null;
      if (!finger.on) return;
      const first = trail[0];
      const last = trail[trail.length - 1];
      const speed = last && first && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      finger.asked = finger.progress > FAR_ENOUGH || speed > FLICK ? "on" : "back";
      if (event.type === "touchcancel") finger.asked = "back";
      letFingerGo();
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
    document.addEventListener("touchcancel", up);
    return () => {
      window.clearTimeout(lost);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
      document.removeEventListener("touchcancel", up);
    };
  }, [inApp]);
}

/**
 * A page turned back by a tap, inside a room: what is shown now (a record) is laid as a still sheet over the column,
 * `step` makes the change beneath it (the list, back at its place), and once that is drawn the page before comes
 * back over from the left, as the finger's turn does, at the turn's own pace.
 */
/** The column as it stands, laid as a still sheet ready to be turned back from the left. */
function layBackSheet(column: HTMLElement) {
  const place = column.getBoundingClientRect();
  const copy = stillCopy(column);
  Object.assign(copy.style, { position: "fixed", top: `${place.top}px`, left: `${place.left}px`, width: `${place.width}px`, height: `${sheetHeight(place.top)}px`, margin: "0", overflow: "hidden", zIndex: "19", pointerEvents: "none" });
  const frame = stillFrame(column, copy);
  document.body.append(frame);
  return edgeTurn(copy, frame);
}

export async function turnBackOver(column: HTMLElement, step: () => Promise<void>) {
  const turn = layBackSheet(column);
  try {
    await step();
  } catch {
    return turn.end();
  }
  feelTurn();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return turn.end();
  await turn.glide(0, 1);
}
