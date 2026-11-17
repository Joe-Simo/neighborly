"use client";

import { useLayoutEffect, useRef } from "react";
import { HELD_CARD } from "@/lib/held-card";

/** The sheet of paper that rose over the story lifts away to reveal the workspace. */
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
    const lift = element.animate([{ transform: "none" }, { transform: "translateY(-104%)" }], { duration: 900, delay: 320, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" });
    void lift.finished.then(() => { settle(); delete element.dataset.carrying; lift.cancel(); }, () => {});
    return () => { delete element.dataset.carrying; lift.cancel(); };
  }, []);
  return <div ref={sheet} className="neighborly-paper-carry" aria-hidden="true"><span>kind helps</span></div>;
}
