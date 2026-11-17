"use client";

import { Component, createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { ROOM_WHOLE } from "@/lib/room-whole";
import { flushSync } from "react-dom";
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

/** The still copy of the column just left, while it lies on the page. */
let still: HTMLElement | null = null;
const letGo = () => {
  still?.remove();
  still = null;
};

/** The properties a move can be holding at a value of its own, read off the page and written onto the copy. */
const HELD = ["opacity", "transform", "translate", "rotate", "scale", "visibility", "clip-path", "filter", "background-size", "box-shadow"];

/**
 * A picture in the copy, painted from the very picture on screen. A copied <img> picks its source and loads it
 * again, even from the cache, and is blank for the copy's first frame; a canvas drawn from the shown one is not.
 */
function stillPicture(shown: HTMLImageElement, twin: HTMLImageElement) {
  if (!shown.complete || !shown.naturalWidth) return;
  const canvas = document.createElement("canvas");
  const sharp = window.devicePixelRatio || 1;
  canvas.width = Math.round(shown.naturalWidth * sharp);
  canvas.height = Math.round(shown.naturalHeight * sharp);
  canvas.getContext("2d")?.drawImage(shown, 0, 0, canvas.width, canvas.height);
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
  const moving = new Set(document.getAnimations().map((move) => (move.effect instanceof KeyframeEffect ? move.effect.target : null)));
  const from = [column, ...column.querySelectorAll<HTMLElement>("*")];
  const to = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
  from.forEach((element, index) => {
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

/** Lays the still copy over the column, where the column lies on the screen. */
function hold(column: HTMLElement | null) {
  // A room that was never shown is not copied: the copy already lying there, or the "Opening…" line, stays.
  if (!column || still || column.hasAttribute("data-room-held")) return;
  const place = column.getBoundingClientRect();
  const copy = stillCopy(column);
  Object.assign(copy.style, {
    position: "fixed",
    top: `${place.top}px`,
    left: `${place.left}px`,
    width: `${place.width}px`,
    height: `${Math.max(0, window.innerHeight - place.top)}px`,
    margin: "0",
    overflow: "hidden",
    zIndex: "19",
    pointerEvents: "none",
  });
  still = stillFrame(column, copy);
  document.body.append(still);
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
 * The room shown has come to rest: its figures have landed (`data-moving`, CountUp) and nothing in it is still
 * moving to its place (its picture's piece, a row easing in). What moves without end, if anything, does not count.
 */
function atRest(column: HTMLElement) {
  if (column.querySelector("[data-moving]")) return false;
  return !column
    .getAnimations({ subtree: true })
    .some((move) => move.playState === "running" && Number.isFinite(move.effect?.getComputedTiming().endTime));
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
        flushSync(() => {
          setShown(area);
          setOpening(false);
        });
        letGo();
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
    const since = performance.now();
    let frame = requestAnimationFrame(function rest(now) {
      if (atRest(element) || now - since >= LONGEST) return setSettled(area);
      frame = requestAnimationFrame(rest);
    });
    return () => cancelAnimationFrame(frame);
  }, [area, held, column]);
  return { shown: !held, opening: held && opening, lost: held && opening && lost, settled: !held && settled === area };
}
