"use client";

import { type ReactNode, useEffect, useRef } from "react";
import "./chapter-sheets.css";
import { placeTurn, setTurnGeometry, turnGeometry, type TurnGeometry } from "@/lib/page-turn";

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

/**
 * A chapter's page is turned from its lower right corner, and the next chapter is found lying beneath it.
 * The page holds still for one page of scroll while a gently curved crease sweeps along its diagonal to the far corner. What has been lifted is seen from behind, folded back over the crease.
 * Only five places are moved, none redrawn: the crease's round (which trims the page), the page within it, the turned-back underside (with the close shade its free edges throw on the page it lies over), the roll of light along its crease, and the shade on the paper beneath.
 */
export function PageTurn({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const turn = root.current, from = turn?.closest<HTMLElement>(".relief-panel"), to = from?.nextElementSibling;
    const part = (name: string) => turn?.querySelector<HTMLElement>(`.relief-turn-${name}`);
    const round = part("round"), page = part("page"), back = part("back"), roll = part("roll"), shade = part("shade"), hold = turn?.querySelector<HTMLElement>(".relief-hold");
    if (!turn || !from || !(to instanceof HTMLElement) || !round || !page || !back || !roll || !shade || !hold) return;
    const beneath = to.querySelector<HTMLElement>(".relief-hold");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // The page is the whole window, `tall` of it the chapter's own.
    let frame = 0, on = false, tall = 0, last = -1, near = false, geometry: TurnGeometry | null = null;
    const measure = () => {
      // A page taller than the window, or one not held at all (phones), cannot be turned whole, and with less motion nothing is turned: the chapters then follow one another as plain pages.
      const fits = !still.matches && getComputedStyle(hold).position === "sticky" && hold.offsetHeight <= innerHeight + 1;
      if (!fits) {
        if (on) { on = false; last = -1; for (const panel of [from, to]) { panel.removeAttribute("data-turn"); panel.style.removeProperty("--turn-page"); panel.style.removeProperty("--turn-own"); } to.style.removeProperty("--e"); to.style.removeProperty("--h"); }
        return;
      }
      on = true;
      from.dataset.turn = "from"; to.dataset.turn = "to";
      tall = hold.getBoundingClientRect().height;
      geometry = turnGeometry(turn.clientWidth, Math.max(page.offsetHeight, tall));
      for (const panel of [from, to]) panel.style.setProperty("--turn-page", `${tall}px`);
      to.style.setProperty("--turn-own", `${beneath?.getBoundingClientRect().height ?? tall}px`);
      // The chapter beneath is found as it will stay: its picture at rest and its figures standing.
      to.style.setProperty("--e", "1"); to.style.setProperty("--h", "1");
      setTurnGeometry(turn, geometry);
      last = -1;
      update();
    };
    const update = () => {
      frame = 0;
      if (!on || !geometry) return;
      const bottom = from.getBoundingClientRect().bottom;
      const close = bottom < tall * 2.5 && bottom > -tall;
      if (close !== near) { near = close; turn.toggleAttribute("data-near", near); }
      const turned = clamp(1 - bottom / tall);
      if (turned === last) return;
      last = turned;
      // How far the page has been turned off the chapter beneath: what lies under it (the year's figures) stands up as it is uncovered.
      to.style.setProperty("--turned", turned.toFixed(4));
      turn.dataset.turned = placeTurn(geometry, { round, page, back, roll, shade }, turned);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    const sizes = new ResizeObserver(measure);
    sizes.observe(hold); sizes.observe(page); if (beneath) sizes.observe(beneath);
    addEventListener("scroll", request, { passive: true });
    still.addEventListener("change", measure);
    measure();
    return () => { cancelAnimationFrame(frame); sizes.disconnect(); removeEventListener("scroll", request); still.removeEventListener("change", measure); };
  }, []);
  return <div ref={root} className="relief-turn" data-turned="no">
    <div className="relief-turn-shade" aria-hidden="true" />
    <div className="relief-turn-round">
      <div className="relief-turn-page">
        {children}
        <div className="relief-turn-back" aria-hidden="true"><div className="relief-turn-under"><div className="relief-turn-roll" /></div></div>
      </div>
    </div>
  </div>;
}
