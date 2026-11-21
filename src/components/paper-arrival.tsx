"use client";

import { useLayoutEffect, useRef } from "react";
import { HELD_CARD } from "@/lib/held-card";
import { restWhatIsUnderneath, wholeUnderneath } from "@/lib/room-whole";

/** The sheet is up and off in this long, the same as the door's own paper. */
const LIFT = 240;
/** If nothing under the sheet settles, it lifts anyway: what is there says for itself that it is opening. */
const LONGEST = 1200;
/** If the sample neither opens nor says why, the sheet lifts off whatever is there. */
const NO_DOOR = 12000;


/**
 * The sheet of paper that rose over the story lifts away to reveal the workspace. It holds for nothing:
 * it lifts in the frame what is under it is whole, and what is under it is at rest by then.
 */
export function PaperArrival() {
  const sheet = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = sheet.current;
    let carried = false;
    try { carried = sessionStorage.getItem("neighborly-paper") === "1"; } catch { /* Without storage there is no sheet to lift. */ }
    if (!element || !carried) return;
    const settle = () => { try { sessionStorage.removeItem("neighborly-paper"); } catch { /* Nothing was stored. */ } };
    // The home page's card, grown over the window, is already the sheet that lifts off the room (card-offer-grow.tsx): one sheet, never two.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(HELD_CARD)) { settle(); return; }
    element.dataset.carrying = "true";
    const since = performance.now();
    let frame = 0;
    let lift: Animation | undefined;
    // Going to the sample, what is under the sheet first is only the waiting paper: the door's sweep, not this sheet,
    // is what comes off it. The sheet stays until the sweep has come up over it, then goes under it unseen, so no frame
    // ever shows the empty paper between the two: the door takes it away in the frame its own paper starts to lift
    // (door.tsx). A first look is a room, and the sheet lifts off it as off any room.
    const toSample = new URLSearchParams(window.location.search).get("intent") === "sample";
    const look = () => {
      const waited = performance.now() - since;
      if (element.dataset.carrying === undefined) return settle();
      const sweeping = document.documentElement.dataset.door !== undefined;
      // Until a room is drawn, the door sweeps, or the sheet with the sample's refusal on it is shown.
      // Without a first look the room under the sheet is only the signed-out page, taken down the moment the session
      // lands, so the sheet never lifts off it by itself: the sweep takes it. A first look is waited on until whole.
      const coming = toSample && waited < NO_DOOR && !document.querySelector(".live-app .entry") && !(document.documentElement.hasAttribute("data-first-look") && wholeUnderneath());
      if (sweeping || coming) {
        frame = requestAnimationFrame(look);
        return;
      }
      if (!wholeUnderneath() && waited < LONGEST) {
        frame = requestAnimationFrame(look);
        return;
      }
      restWhatIsUnderneath();
      lift = element.animate([{ transform: "none" }, { transform: "translateY(-104%)" }], { duration: LIFT, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" });
      void lift.finished.then(() => { settle(); delete element.dataset.carrying; lift?.cancel(); }, () => {});
    };
    look();
    return () => { cancelAnimationFrame(frame); delete element.dataset.carrying; lift?.cancel(); };
  }, []);
  return <div ref={sheet} className="neighborly-paper-carry" aria-hidden="true"><span>kind helps</span></div>;
}
