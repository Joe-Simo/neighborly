"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";
import "@/components/workspace/door.css";

/**
 * The paper's welcome for someone who has just come through the door: the sign-in sheet or the sample link.
 * Three sheets sweep up the instant the sheet leaves, while the room loads under them; the last is paper.
 * It adds no wait: the paper lifts as soon as it has landed and the room under it is whole (heading, picture
 * and the head button in its final style). If the room is not ready yet the paper holds with the one quiet
 * opening line on it, and lifts when the room is. Never between rooms, and never for someone already signed
 * in, who goes from the launch mark straight to their room.
 */
const SWEEP = 380;
const LIFT = 140;
/** A wait is quiet at first: the line is not drawn for this long after the paper is down. With no sweep the paper is down at once, so the quiet is longer. */
const QUIET = 400;
const QUIET_PLAIN = 1000;
/** Once drawn, the line stays long enough to be read: a line that flashes is worse than none. */
const READ = 700;
/** The green is already rising in the first frame the sheet is gone. */
const HEAD_START = 48;
/** If nothing under the paper ever settles, it lifts anyway and shows what is there. */
const LONGEST = 12000;

let arrivals = 0;
// Kept beside the count, not in the component, so the sweep keeps its clock however the tree under it is redrawn.
let finished = 0;
let arrivedAt = 0;
const watchers = new Set<() => void>();
/** Called in the frame the door's sheet leaves. */
export function arriveFromTheDoor() {
  arrivals += 1;
  arrivedAt = performance.now();
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
  if (room) return document.querySelector(".live-app[data-room-whole]") !== null;
  return document.querySelector(".paper-loading") === null;
}

export function DoorSweep() {
  const arrival = useSyncExternalStore(watch, () => arrivals, () => 0);
  const done = useSyncExternalStore(watch, () => finished, () => 0);
  const [holding, setHolding] = useState(false);
  const paper = useRef<HTMLDivElement>(null);
  const [language] = useEntryLanguage();
  const playing = arrival > done;

  // Drawn again part way through, the sheets carry on from where the clock is; they never start over.
  useLayoutEffect(() => {
    if (playing) paper.current?.style.setProperty("--door-since", `${Math.round(performance.now() - arrivedAt) + HEAD_START}ms`);
  }, [playing]);
  useEffect(() => {
    if (!playing) return;
    const plain = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lifting = false;
    let saidAt = 0;
    const lift = () => {
      lifting = true;
      // The line leaves first, in this same frame, so it is never read over the room.
      paper.current?.querySelector<HTMLElement>(".door-opening")?.style.setProperty("visibility", "hidden");
      setHolding(false);
      const leave = paper.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: plain ? 180 : LIFT, easing: "linear", fill: "forwards" });
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
      const waited = performance.now() - arrivedAt;
      const landed = plain || waited >= SWEEP;
      const read = saidAt === 0 || performance.now() - saidAt >= READ;
      if (landed && read && (underneathIsReady() || waited > LONGEST)) return lift();
      if (landed && saidAt === 0 && waited >= (plain ? QUIET_PLAIN : SWEEP + QUIET)) {
        saidAt = performance.now();
        setHolding(true);
      }
      frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [playing, arrival]);

  if (!playing) return null;
  return createPortal(
    <div className="door-sweep" ref={paper} aria-hidden={holding ? undefined : true}>
      {["#365c46", "#6f5f93", "#f7f4ed"].map((fill, sheet) => (
        <svg key={fill} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fill={fill} d={["M0 9C18 1 34 13 53 7S84 0 100 8V100H0Z", "M0 5C22 12 40 0 60 6S88 12 100 4V100H0Z", "M0 10C16 3 38 9 56 4S86 11 100 6V100H0Z"][sheet]} />
        </svg>
      ))}
      {holding && (
        <p className="door-opening" role="status">
          <LoaderCircle size={20} aria-hidden="true" />
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
