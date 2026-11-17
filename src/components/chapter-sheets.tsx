"use client";

import { useEffect, useRef } from "react";
import "./chapter-sheets.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Where one chapter gives way to the next, the next chapter's paper is drawn over the last as a cut sheet.
 * The sheet is only ever the colour of the paper already lying beneath it, so when it has crossed, it is put away and nothing changes.
 */
// `under` is how far the sheet reaches below the next chapter's first edge: the close's own paper begins with a 56 px cut edge, and the sheet lies beneath it there.
const sheets = {
  // The story's paper is drawn across the courtyard from the right. It answers the first pixel, then keeps most of its crossing for late in the change, so the courtyard is in sight and little paper lies bare for as long as may be.
  story: { next: ".relief-story", under: 1, pace: (risen: number) => risen * .25 + risen ** 2.2 * .75 },
  // The close's paper is laid back down from the top, as the opening's sheet was lifted from the foot. It waits longer still: the sample's sheet above it is something to be read and used.
  close: { next: ".neighborly-together", under: 57, pace: (risen: number) => risen * .06 + risen ** 4 * .94 },
};

export function ChapterSheet({ to }: { to: keyof typeof sheets }) {
  const paper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = paper.current, next = sheet?.closest<HTMLElement>(sheets[to].next) ?? sheet?.parentElement?.querySelector<HTMLElement>(sheets[to].next);
    if (!sheet || !next) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, across = "", foot = "", lie = "", tall = "";
    const update = () => {
      frame = 0;
      const box = next.getBoundingClientRect(), top = box.top, height = innerHeight;
      // The next chapter's paper comes over as that chapter's first edge rises from the foot of the window to its top.
      const crossed = sheets[to].pace(clamp((height - top) / height));
      if (to === "close") {
        // The close's sheet is part of the page above the rooms, so it is not moved: only its foot is, counted from the sheet's own top, which stands one window above the rooms' edge.
        const edge = Math.max(36, Math.min(64, innerWidth * .044));
        const shown = top <= 0 || crossed <= 0 ? -200 : (still.matches ? Number(crossed >= .5) : crossed) * (height + edge) - edge - (top + sheets.close.under - sheet.offsetHeight);
        const nowLie = `${shown.toFixed(1)}px`, nowTall = `${box.height.toFixed(0)}px`;
        if (nowLie !== lie) { lie = nowLie; sheet.style.setProperty("--lie", lie); sheet.toggleAttribute("data-away", shown === -200); }
        if (nowTall !== tall) { tall = nowTall; sheet.style.setProperty("--paper-h", tall); }
        return;
      }
      const nowAcross = top <= 0 || crossed <= 0 ? "0" : still.matches ? String(Number(crossed >= .5)) : crossed.toFixed(4);
      const nowFoot = `${Math.max(0, Math.min(height, top + sheets[to].under)).toFixed(1)}px`;
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
  }, [to]);
  return <div ref={paper} className={to === "close" ? "chapter-sheet-close" : `chapter-sheet chapter-sheet-${to}`} data-away="" aria-hidden="true" />;
}
