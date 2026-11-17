"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";
import { dropTheHeldCard, takeTheHeldCard } from "@/lib/held-card";
import "@/components/workspace/door.css";

/**
 * The paper's welcome for someone who has just come through the door: the sign-in sheet or the sample link.
 * Three sheets sweep up the instant the sheet leaves, while the room loads under them; the last is paper.
 * It adds no wait: the paper lifts as soon as it has landed and the room under it is whole (heading, picture
 * and the head button in its final style). If the room is not ready yet the sheet holds and lifts when the room
 * is. Plain paper holds with the one quiet opening line on it. The card holds as the card: its marks stay, its
 * ochre square breathes (ochre is waiting), the line is only spoken, and the moment the room is whole the card
 * lifts and its marks go to their places. Only a wait past LATE draws the line, low on the card. Never between rooms, and never for someone already signed
 * in, who goes from the launch mark straight to their room.
 */
const SWEEP = 380;
/** The last sheet is lifted up and off the room, which is already whole under it. */
const LIFT = 220;
/** A wait is quiet at first: the line is not drawn for this long after the paper is down. With no sweep the paper is down at once, so the quiet is longer. */
const QUIET = 400;
const QUIET_PLAIN = 1000;
/** Once drawn, the line stays long enough to be read: a line that flashes is worse than none. */
const READ = 700;
/** The card says nothing in writing until the wait has been this long after it landed. */
const LATE = 4000;
/** The green is already rising in the first frame the sheet is gone. */
const HEAD_START = 48;
/** If nothing under the paper ever settles, it lifts anyway and shows what is there. */
const LONGEST = 12000;

let arrivals = 0;
// Kept beside the count, not in the component, so the sweep keeps its clock however the tree under it is redrawn.
let finished = 0;
let arrivedAt = 0;
// The home page's card is the last sheet for someone it sent to the sample; anyone else gets plain paper.
let carried = false;
// The home page's card was already saying "Opening…" when the sweep took it over: the sweep goes on saying it, with no gap.
let heldSaying = false;
/** The name the visitor wrote on the home page's card, if any: read here only, so it stays on the card through the handover. */
function readCardFor() {
  try {
    return window.sessionStorage.getItem("kh-card-for")?.trim().slice(0, 24) || "";
  } catch {
    return "";
  }
}
let card = false;
/** Called by the door when it starts opening the sample, and again with false if the sample did not open. */
export function carryTheCard(carry = true) {
  carried = carry;
  // The sample did not open: the card the home page grew is let go, and the door's sheet with its notice is under it.
  if (!carry) dropTheHeldCard();
}
const watchers = new Set<() => void>();
/** Someone has just come through the door and is still in the first room: figures are drawn at their value, not rolled. */
export const cameThroughTheDoor = () => typeof document !== "undefined" && document.documentElement.dataset.fromDoor !== undefined;
/** Called in the frame the door's sheet leaves. */
export function arriveFromTheDoor() {
  arrivals += 1;
  arrivedAt = performance.now();
  card = carried;
  carried = false;
  // The room under the paper is drawn finished: its own entry is skipped until the next room (door.css; the shell lifts the mark).
  document.documentElement.dataset.fromDoor = "";
  // For anything outside the page that must give way to the sweep (the iPhone app's strip): there for the whole run.
  document.documentElement.dataset.door = "sweeping";
  for (const watch of watchers) watch();
}
const watch = (watcher: () => void) => {
  watchers.add(watcher);
  return () => void watchers.delete(watcher);
};

/**
 * What is under the paper is ready to be seen: the room says it is whole, or the door led somewhere that
 * is not a room and not the waiting screen (a first welcome, a plain notice).
 */
function underneathIsReady() {
  const room = document.querySelector(".live-app .live-room");
  // A part of the room that is still on its way says so (`data-room-pending`), and the paper waits for it too.
  if (room) return document.querySelector(".live-app[data-room-whole]") !== null && document.querySelector(".live-app [data-room-pending]") === null;
  return document.querySelector(".paper-loading") === null;
}

export function DoorSweep() {
  const arrival = useSyncExternalStore(watch, () => arrivals, () => 0);
  const done = useSyncExternalStore(watch, () => finished, () => 0);
  /** A wait: "spoken" is the line for screen readers only (the card holds as itself), "shown" draws it. */
  const [holding, setHolding] = useState<false | "spoken" | "shown">(false);
  const [cardFor] = useState(readCardFor);
  const paper = useRef<HTMLDivElement>(null);
  const [language] = useEntryLanguage();
  const playing = arrival > done;

  // Drawn again part way through, the sheets carry on from where the clock is; they never start over.
  useLayoutEffect(() => {
    if (!playing) return;
    paper.current?.style.setProperty("--door-since", `${Math.round(performance.now() - arrivedAt) + HEAD_START}ms`);
    // The home page's card has been held over the window all along: the sweep's card is already at full size, so nothing sweeps up.
    if (card) {
      heldSaying = document.querySelector("#card-held[data-saying]") !== null;
      if (takeTheHeldCard()) paper.current?.setAttribute("data-held", "");
    }
  }, [playing]);
  useEffect(() => {
    if (!playing) return;
    const plain = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lifting = false;
    let saidAt = 0;
    let goOnSaying = heldSaying;
    heldSaying = false;
    const lift = () => {
      lifting = true;
      // The line leaves first, in this same frame, so it is never read over the room.
      paper.current?.querySelector<HTMLElement>(".door-opening")?.style.setProperty("visibility", "hidden");
      setHolding(false);
      // Whatever in the room is still arriving is finished now: the sheet comes off a room at rest.
      for (const move of document.getAnimations()) {
        const on = move.effect instanceof KeyframeEffect ? move.effect.target : null;
        if (on?.closest(".live-app") && move.effect?.getComputedTiming().iterations !== Infinity) move.finish();
      }
      const sheet = paper.current?.querySelector<HTMLElement>(".door-card, .door-paper");
      const far = -((sheet?.getBoundingClientRect().bottom ?? window.innerHeight) + 70);
      const away = { duration: LIFT, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" } as const;
      const leave = sheet && !plain
        ? sheet.animate([{ transform: "none" }, { transform: `translateY(${far}px)` }], away)
        : paper.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "linear", fill: "forwards" });
      if (sheet && !plain) {
        // The sheets behind are long covered; they go at once, so the one sheet is all that is over the room.
        for (const behind of paper.current?.querySelectorAll<SVGElement>(":scope > svg") ?? []) behind.style.display = "none";
        sheet.style.visibility = "visible";
        // The card's marks and the name are on the paper: they ride up and leave with it, and nothing is left over the room.
      }
      const over = () => {
        setHolding(false);
        delete document.documentElement.dataset.door;
        finished = arrival;
        for (const watch of watchers) watch();
      };
      if (leave) leave.finished.then(over, over);
      else over();
    };
    const look = () => {
      if (lifting) return;
      if (goOnSaying) {
        goOnSaying = false;
        // The home page's card already said it is opening: the hold carries on as shown, never spoken again.
        saidAt = performance.now() - READ;
        const said = paper.current?.querySelector<HTMLElement>(".door-card");
        if (said) said.dataset.holds = "";
        setHolding("shown");
      }
      const waited = performance.now() - arrivedAt;
      const landed = plain || waited >= SWEEP;
      const read = saidAt === 0 || performance.now() - saidAt >= READ;
      if (landed && read && (underneathIsReady() || waited > LONGEST)) return lift();
      const held = plain ? null : paper.current?.querySelector<HTMLElement>(".door-card");
      if (held) {
        // The card waits as the card. Nothing is drawn that must then be read, so it lifts the frame the room is whole.
        if (landed && held.dataset.holds === undefined && waited >= SWEEP + QUIET) {
          held.dataset.holds = "";
          setHolding("spoken");
        }
        if (saidAt === 0 && waited >= SWEEP + LATE) {
          saidAt = performance.now();
          setHolding("shown");
        }
      } else if (landed && saidAt === 0 && waited >= (plain ? QUIET_PLAIN : SWEEP + QUIET)) {
        saidAt = performance.now();
        // A wait on a sheet with no motion: the card's marks are not drawn, and the line stands alone.
        paper.current?.querySelector(".door-card")?.setAttribute("data-waits", "");
        setHolding("shown");
      }
      frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [playing, arrival]);

  if (!playing) return null;
  return createPortal(
    <div className="door-sweep" ref={paper} aria-hidden={holding ? undefined : true}>
      {["#365c46", "#6f5f93", "#f7f4ed"].slice(0, card ? 2 : 3).map((fill, sheet) => (
        <svg key={fill} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fill={fill} d={["M0 9C18 1 34 13 53 7S84 0 100 8V100H0Z", "M0 5C22 12 40 0 60 6S88 12 100 4V100H0Z", "M0 10C16 3 38 9 56 4S86 11 100 6V100H0Z"][sheet]} />
        </svg>
      ))}
      {/* The card passed on the home page, grown to the size of the page: its mark and two lines thin away as it becomes the paper. */}
      {card ? <div className="door-card"><i /><b /><b />{cardFor && <span className="door-card-for"><em>For {cardFor}</em></span>}</div> : <div className="door-paper" />}
      {holding && (
        <p className="door-opening" role="status" data-spoken={holding === "spoken" ? "" : undefined} data-low={card ? "" : undefined}>
          <span>{wordsFor(language).states.opening}</span>
        </p>
      )}
    </div>,
    document.body,
  );
}

/** Tells the sweep when the door's sheet has just left: it was showing, and now someone is signed in. */
export function useDoor(atTheDoor: boolean) {
  const stood = useRef(false);
  useLayoutEffect(() => {
    if (atTheDoor) stood.current = true;
    else if (stood.current) {
      stood.current = false;
      arriveFromTheDoor();
    }
  }, [atTheDoor]);
}
