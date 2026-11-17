"use client";

import { useEffect, useRef } from "react";
import "./chapter-sheets.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Where one chapter gives way to the next, the next chapter's paper is drawn over the last as a cut sheet.
 * The sheet is only ever the colour of the paper already lying beneath it, so when it has crossed, it is put away and nothing changes.
 */
export function ChapterSheets() {
  const story = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = story.current, next = sheet?.parentElement?.querySelector<HTMLElement>(".relief-story");
    if (!sheet || !next) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, across = "", foot = "";
    const update = () => {
      frame = 0;
      const top = next.getBoundingClientRect().top, height = innerHeight;
      // The story's paper comes across from the right as the story's first edge rises from the foot of the window to its top.
      // It answers the first pixel, then keeps most of its crossing for late in the change, so the courtyard is in sight and little paper lies bare for as long as may be.
      const risen = clamp((height - top) / height);
      const crossed = risen * .25 + risen ** 2.2 * .75;
      const nowAcross = top <= 0 || crossed <= 0 ? "0" : still.matches ? String(Number(crossed >= .5)) : crossed.toFixed(4);
      const nowFoot = `${Math.max(0, Math.min(height, top + 1)).toFixed(1)}px`;
      // Each value is written on the sheet alone, and only when it has changed.
      if (nowAcross !== across) { across = nowAcross; sheet.style.setProperty("--across", across); sheet.toggleAttribute("data-away", across === "0"); }
      if (across !== "0" && nowFoot !== foot) { foot = nowFoot; sheet.style.setProperty("--foot", foot); }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    still.addEventListener("change", request);
    update();
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", request); removeEventListener("resize", request); still.removeEventListener("change", request); };
  }, []);
  return <div ref={story} className="chapter-sheet chapter-sheet-story" data-away="" aria-hidden="true" />;
}
