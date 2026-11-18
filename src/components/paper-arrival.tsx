"use client";

import { useLayoutEffect, useRef } from "react";
import { HELD_CARD } from "@/lib/held-card";
import { restWhatIsUnderneath, wholeUnderneath } from "@/lib/room-whole";

/** The sheet is up and off in this long, the same as the door's own paper. */
const LIFT = 240;
/** If nothing under the sheet settles, it lifts anyway: what is there says for itself that it is opening. */
const LONGEST = 1200;


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
    const look = () => {
      if (!wholeUnderneath() && performance.now() - since < LONGEST) {
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
