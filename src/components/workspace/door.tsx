"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";
import { readCardWord } from "@/lib/card-for";
import { HELD_CARD, dropTheHeldCard, takeTheHeldCard } from "@/lib/held-card";
import { restWhatIsUnderneath, underneathIsReady } from "@/lib/room-whole";
import { ROOM_WHOLE } from "@/components/workspace/room-sheet";
import { roomTurn } from "@/components/workspace/room-turn";
import "@/components/workspace/door.css";
import { EASE_PAPER_LEAVE } from "@/lib/motion";

/**
 * The paper's welcome for someone who has just come through the door: the sign-in sheet or the sample link.
 * Three sheets sweep up the instant the sheet leaves, while the room loads under them; the last is paper.
 * It adds no wait: the paper lifts as soon as it has landed and the room under it is whole (heading, picture
 * and the head button in its final style). If the room is not ready yet the sheet holds and lifts when the room
 * is. Plain paper holds with the one quiet opening line on it. The card holds as the card: its marks stay, its
 * ochre square holds at one colour (ochre is waiting), the line is only spoken, and the moment the room is whole the card
 * lifts and its marks go to their places. Only a wait past LATE draws the line, low on the card. Never between rooms, and never for someone already signed
 * in, who goes from the launch mark straight to their room.
 */
const SWEEP = 380;
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
/**
 * The public sheet as it stood the moment the sign-in was given, held over the page in two halves along its middle
 * (w90). On the web the sweep's sheets are not drawn for it: this is the paper over the room, and when the room is
 * whole its foot folds up behind it, printed face out, and the folded sheet is carried up off the room.
 */
let heldSheet: HTMLElement | null = null;
/** Called by the sign-in sheet in the frame it leaves, with its answer given; never in the iPhone app, nor for less motion. */
export function holdTheSheet() {
  const entry = document.querySelector<HTMLElement>(".entry");
  if (!entry || heldSheet) return;
  const hold = document.createElement("div");
  hold.className = "door-fold";
  hold.setAttribute("aria-hidden", "true");
  hold.inert = true;
  const scrolled = window.scrollY;
  // The page's own ground is under the sheet; each half carries it, so nothing of the room shows through before it should.
  const ground = getComputedStyle(document.body).backgroundColor;
  for (const half of ["top", "foot"]) {
    const copy = entry.cloneNode(true) as HTMLElement;
    // What was typed lives in the fields, not in the page's markup: it is written into the copy, so nothing on the sheet changes.
    const typed = entry.querySelectorAll<HTMLInputElement>("input");
    copy.querySelectorAll<HTMLInputElement>("input").forEach((field, at) => field.setAttribute("value", typed[at]?.value ?? ""));
    copy.querySelectorAll("[id]").forEach((named) => named.removeAttribute("id"));
    copy.style.setProperty("translate", `0 ${-scrolled}px`);
    const side = document.createElement("div");
    side.className = "door-fold-half";
    side.dataset.half = half;
    side.style.backgroundColor = ground;
    // The sheet's look comes from the page around it (`.live-app`, its language): the copy is set in the same, so not a line of it changes.
    const around = entry.closest(".live-app")?.cloneNode(false) as HTMLElement | undefined;
    if (around) {
      around.removeAttribute("id");
      around.append(copy);
    }
    side.append(around ?? copy);
    hold.append(side);
  }
  document.body.append(hold);
  heldSheet = hold;
}
const FOLD = 240;
const CARRY = 220;
/**
 * The held sheet folds over the whole room: its foot turns up behind the top, so the printed face (the painting and
 * the card) stays outward, and the folded sheet is carried up off the room showing that face. Resolves once nothing is left.
 */
function foldTheSheet(hold: HTMLElement) {
  const [top, foot] = hold.querySelectorAll<HTMLElement>(".door-fold-half");
  foot.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)", visibility: "hidden" }], { duration: FOLD, easing: EASE_PAPER_LEAVE, fill: "forwards" });
  const up = top.animate([{ transform: "none" }, { transform: `translateY(${-Math.round(window.innerHeight * 0.5 + 40)}px)` }], { duration: CARRY, delay: FOLD - 40, easing: EASE_PAPER_LEAVE, fill: "forwards" });
  return up.finished.then(() => undefined);
}
/** The home story's sheet that the sweep came up over (paper-arrival.tsx) is let go, under the door's paper. */
function letGoOfTheStory() {
  document.querySelector(".neighborly-paper-carry[data-carrying]")?.removeAttribute("data-carrying");
}
function letGoOfTheSheet() {
  heldSheet?.remove();
  heldSheet = null;
}
/** Called by the door when it starts opening the sample, and again with false if the sample did not open. */
export function carryTheCard(carry = true) {
  carried = carry;
  // The sample did not open: the card the home page grew is let go, and the door's sheet with its notice is under it.
  if (!carry) dropTheHeldCard();
}
const watchers = new Set<() => void>();
/** Someone has just come through the door and is still in the first room: figures are drawn at their value, not rolled. */
/** Called in the frame the door's sheet leaves. */
function arriveFromTheDoor() {
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
 * Through the door, focus lands on the room's head once the paper is off it, as it does between rooms: a screen reader
 * says where the person has arrived, and the next Tab goes on from the top of the room. Only when nothing else holds it.
 */
/** After the frame now being drawn has been painted: what follows never lands in the same frame as the paper going. */
const afterAPaint = (then: () => void) => requestAnimationFrame(() => requestAnimationFrame(then));

function restOnTheRoomHead() {
  // Focus left on the door's way in (the sign-in sheet folded away, or anything else no longer in the room) is not
  // something the person chose in the room, so it is moved too; focus already inside the room or a sheet over it stays.
  const now = document.activeElement;
  if (now && now !== document.body && now.isConnected && now.closest(".live-layout, .live-header, [role=dialog]") && !now.closest(".live-auth")) return;
  const head = document.querySelector<HTMLElement>(".live-app .live-page-head h1");
  if (!head) return;
  if (!head.hasAttribute("tabindex")) head.tabIndex = -1;
  head.focus({ preventScroll: true });
}

export function DoorSweep() {
  const arrival = useSyncExternalStore(watch, () => arrivals, () => 0);
  const done = useSyncExternalStore(watch, () => finished, () => 0);
  /** A wait: "spoken" is the line for screen readers only (the card holds as itself), "shown" draws it. */
  const [holding, setHolding] = useState<false | "spoken" | "shown">(false);
  const [cardFor] = useState(readCardFor);
  // The word the card itself was lettered with, so it is the same word from the hand to the room.
  const [cardWord] = useState(readCardWord);
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
    // Taken over from the home page's card, the paper is down already: there is no sweep to wait out.
    // The public sheet held from sign-in is the paper itself: it is down already, and it folds rather than lifts.
    const folds = heldSheet !== null && !card;
    if (!folds) letGoOfTheSheet();
    const down = folds || (paper.current?.hasAttribute("data-held") ?? false);
    const lift = () => {
      lifting = true;
      // The home page's card may still lie over this one, identical to it, for a few frames: it goes now, so the lift is seen from its first frame.
      document.getElementById(HELD_CARD)?.remove();
      // The line leaves first, in this same frame, so it is never read over the room.
      paper.current?.querySelector<HTMLElement>(".door-opening")?.style.setProperty("visibility", "hidden");
      setHolding(false);
      restWhatIsUnderneath();
      if (folds) {
        const over = () => {
          letGoOfTheSheet();
          letGoOfTheStory();
          setHolding(false);
          delete document.documentElement.dataset.door;
          afterAPaint(restOnTheRoomHead);
          finished = arrival;
          for (const watch of watchers) watch();
        };
        if (heldSheet) foldTheSheet(heldSheet).then(over, over);
        else over();
        return;
      }
      const sheet = paper.current?.querySelector<HTMLElement>(".door-card, .door-paper");
      let leave: Promise<unknown> | undefined;
      if (sheet && paper.current && !plain) {
        // The last sheet is turned off the room as one room's page is turned off the next (room-turn.ts): its lower right corner
        // lifts and folds back, and the room the door opens on is found lying beneath. The paper as it stands in the window is the page turned:
        // a still copy of it, the sheets behind long covered and left out, its marks where they are, nothing moving on it.
        const page = paper.current.cloneNode(true) as HTMLElement;
        page.removeAttribute("aria-hidden");
        // Named for anyone checking the door frame by frame: the still copy of the door's paper, and (below) the turn that carries it.
        page.setAttribute("data-door-still", "");
        page.querySelectorAll(":scope > svg, .door-opening").forEach((behind) => behind.remove());
        for (const part of [page, ...page.querySelectorAll<HTMLElement>("*")]) part.style.animation = "none";
        page.querySelector<HTMLElement>(".door-card, .door-paper")?.style.setProperty("visibility", "visible");
        Object.assign(page.style, { position: "fixed", inset: "auto", width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, zIndex: "auto" });
        const frame = document.createElement("div");
        frame.append(page);
        const turn = roomTurn(page, frame);
        // Over the whole window, as the door's paper is (door.css), not only over a room's column.
        const turning = document.body.lastElementChild;
        if (turning instanceof HTMLElement) {
          turning.style.zIndex = "80";
          turning.setAttribute("data-door-turn", "");
        }
        // The copy lies exactly where the paper lay: the paper goes in this same frame, and the turn's first frame only moves paper.
        paper.current.style.visibility = "hidden";
        leave = turn.play();
        // The home story's sheet, kept under the sweep (paper-arrival.tsx), goes only once the turning copy has been
        // painted over it, however long that first frame takes: no frame is left with only the bare paper.
        afterAPaint(letGoOfTheStory);
      } else if (paper.current) {
        // With less motion asked for (or no sheet to turn) the paper is simply gone: one cut, nothing played.
        paper.current.style.visibility = "hidden";
        letGoOfTheStory();
      }
      const over = () => {
        setHolding(false);
        delete document.documentElement.dataset.door;
        afterAPaint(restOnTheRoomHead);
        finished = arrival;
        for (const watch of watchers) watch();
      };
      if (leave) leave.then(over, over);
      // The cut is painted on its own frame; the room's settling comes after it, never in the same frame.
      else afterAPaint(over);
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
      const landed = plain || down || waited >= SWEEP;
      const read = saidAt === 0 || performance.now() - saidAt >= READ;
      // The public sheet comes off a room at rest (`data-room-whole`): every part of it in place, its figures landed.
      const ready = underneathIsReady() && (!folds || document.querySelector(".live-app[data-room-whole]") !== null);
      if (landed && read && (ready || waited > LONGEST)) return lift();
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
    // The room says the frame it is whole (room-sheet.tsx), before that frame is painted: the paper is looked at then,
    // not a frame later. The look each frame goes on beside it, for the line's own clock and a part that arrives late.
    const whole = () => {
      cancelAnimationFrame(frame);
      look();
    };
    window.addEventListener(ROOM_WHOLE, whole);
    return () => {
      window.removeEventListener(ROOM_WHOLE, whole);
      cancelAnimationFrame(frame);
    };
  }, [playing, arrival]);

  if (!playing) return null;
  return createPortal(
    <div className="door-sweep" ref={paper} data-folds={heldSheet && !card ? "" : undefined} aria-hidden={holding ? undefined : true}>
      {["#365c46", "#6f5f93", "#f7f4ed"].slice(0, card ? 2 : 3).map((fill, sheet) => (
        <svg key={fill} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fill={fill} d={["M0 9C18 1 34 13 53 7S84 0 100 8V100H0Z", "M0 5C22 12 40 0 60 6S88 12 100 4V100H0Z", "M0 10C16 3 38 9 56 4S86 11 100 6V100H0Z"][sheet]} />
        </svg>
      ))}
      {/* The card passed on the home page, grown to the size of the page: its mark and two lines thin away as it becomes the paper. */}
      {card ? <div className="door-card"><i />{cardFor && <span className="door-card-for"><em>{cardWord} {cardFor}</em></span>}</div> : <div className="door-paper" />}
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
