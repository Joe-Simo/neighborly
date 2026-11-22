"use client";

import { useLayoutEffect, useRef } from "react";
import { HELD_CARD } from "@/lib/held-card";
import { ROOM_WHOLE, restWhatIsUnderneath, wholeUnderneath } from "@/lib/room-whole";
import { afterAPaint, nextLook } from "@/lib/next-look";
import { EASE_PAPER_LEAVE } from "@/lib/motion";

/** The sheet is up and off in this long, the same as the door's own paper. */
const LIFT = 240;
/** If nothing under the sheet settles, it lifts anyway: what is there says for itself that it is opening. */
const LONGEST = 1200;
/** If the sample neither opens nor says why, the sheet lifts off whatever is there. */
const NO_DOOR = 12000;


/** Set by the home page (neighborly-experience.tsx) when the story's sheet is carried over the window into the workspace. */
const CARRIED = "neighborly-paper";

/**
 * Whether the story's sheet came with this page: read from the flag once, before the first paint of the first mount,
 * and never again. A sheet drawn again (its layout remounted) takes this answer, so the flag going (or staying) can never
 * bring the sheet back; once the sheet has left, this says no for the rest of the page.
 */
let carried: boolean | undefined;

/**
 * The sheet of paper that rose over the story lifts away to reveal the workspace. It holds for nothing:
 * it lifts in the frame what is under it is whole, and what is under it is at rest by then.
 */
export function PaperArrival() {
  const sheet = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = sheet.current;
    try { carried ??= sessionStorage.getItem(CARRIED) === "1"; } catch { /* Without storage there is no sheet to lift. */ }
    if (!element || !carried) return;
    let stop = () => {};
    // The sheet's leaving: from now on it is never drawn on this page, whatever the flag says. The flag goes only once
    // what is under it has been painted whole (a room, as a rule), or after the next room shown whole if it is not yet.
    // Only a page that read the flag gets here, so the store is open.
    const clear = () => afterAPaint(() => sessionStorage.removeItem(CARRIED));
    const leave = () => {
      stop();
      carried = false;
      delete element.dataset.carrying;
      if (wholeUnderneath()) clear();
      else addEventListener(ROOM_WHOLE, clear, { once: true });
    };
    // The home page's card, grown over the window, is already the sheet that lifts off the room (card-offer-grow.tsx): one sheet, never two.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(HELD_CARD)) return leave();
    element.dataset.carrying = "true";
    const since = performance.now();
    let lift: Animation | undefined;
    // The door's sweep says, in the frame its paper starts to leave, that the paper still lies over everything (door.tsx):
    // the sheet lets go then, unseen beneath it, so the lift uncovers only what the door opens on.
    addEventListener("kh-story-taken", leave);
    // Going to the sample, what is under the sheet first is only the waiting paper: the door's sweep, not this sheet,
    // is what comes off it. The sheet stays until the sweep has come up over it, and goes under the door's paper the
    // moment that paper starts to lift, so the lift never uncovers it. A first look is a room, and the sheet lifts off it
    // as off any room.
    const toSample = new URLSearchParams(window.location.search).get("intent") === "sample";
    const look = () => {
      const waited = performance.now() - since;
      const sweeping = document.documentElement.dataset.door !== undefined;
      // Until a room is drawn, the door sweeps, or the sheet with the sample's refusal on it is shown.
      // Without a first look the room under the sheet is only the signed-out page, taken down the moment the session
      // lands, so the sheet never lifts off it by itself: the sweep takes it. A first look is waited on until whole.
      // The sign-in sheet counts only once it says the sample would not open: the copy the server drew of it, there
      // for a moment before the page knows where it is going, is not somewhere to lift onto.
      const coming = toSample && waited < NO_DOOR && !document.querySelector(".live-app .entry .live-failure") && !(document.documentElement.hasAttribute("data-first-look") && wholeUnderneath());
      if (sweeping || coming || (!wholeUnderneath() && waited < LONGEST)) {
        // Once a frame; in a page that draws none, still (next-look.ts), so the sheet is never left standing.
        stop = nextLook(look);
        return;
      }
      restWhatIsUnderneath();
      lift = element.animate([{ transform: "none" }, { transform: "translateY(-104%)" }], { duration: LIFT, easing: EASE_PAPER_LEAVE, fill: "forwards" });
      void lift.finished.then(leave, () => {});
    };
    look();
    // Drawn again (its layout remounted), the next mount carries on from what this page has read; the element goes with this one.
    return () => { removeEventListener("kh-story-taken", leave); stop(); lift?.cancel(); };
  }, []);
  return <div ref={sheet} className="neighborly-paper-carry" aria-hidden="true"><span>kind helps</span></div>;
}
