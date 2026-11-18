"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The courtyard's own cut sheets (P26), back to front: the painting cut along its depth, its people on a sheet of their own. */
const sheets = ["0", "1", "people", "2", "3", "4", "5"] as const;
const source = (sheet: (typeof sheets)[number], width: 960 | 1774) =>
  sheet === "people" ? `/assets/made/courtyard-people-${width}.webp` : `/assets/made/courtyard-sheet-${sheet}-${width}.webp`;

const still = () => () => {};
const firstVisit = () => {
  try { return localStorage.getItem(SEEN) !== "1" && !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
const SEEN = "kh-courtyard-assembled";
/** Each sheet stands up from 60° in this long, the next one starting this much later: 1.5s for the six that stand on the far one. */
const STAND = 750, NEXT = 150;
/** It starts once the doors stand this far open, so the courtyard is seen arriving, not glimpsed through a slit. */
const OPEN = 0.45 * 0.05; // --door-progress runs 0 to .05 (fresco-threshold.tsx)

/**
 * A visitor's first time through the doors, the courtyard arrives as the sheets it is cut from, standing up into place from the back,
 * then is the painting again. Once per visitor; never with Reduce Motion; never part-drawn: if its sheets are not all ready
 * when the doors begin to open, the painting simply stands as always.
 */
export function CourtyardAssembly() {
  const host = useRef<HTMLDivElement>(null);
  const first = useSyncExternalStore(still, firstVisit, () => false);
  const [over, setOver] = useState(false);
  const here = first && !over;

  useEffect(() => {
    const element = host.current;
    const stage = element?.closest<HTMLElement>(".fresco-stage");
    if (!here || !element || !stage) return;
    // Hand over in place: the painting and its canvas have been drawn underneath all along, so the sheets only stop showing,
    // and leave the page later, when the browser is idle.
    let leave = 0;
    const done = () => {
      delete stage.dataset.assembling;
      element.dataset.over = "true";
      leave = window.setTimeout(() => requestIdleCallback(() => setOver(true), { timeout: 2000 }), 1000);
    };
    let ready = false, played = false;
    const images = [...element.querySelectorAll("img")];
    void Promise.all(images.map(image => image.decode())).then(() => { ready = true; }, () => {});
    stage.dataset.assembling = "true";
    // Read after the doors have been placed for this frame (fresco-threshold.tsx sets --door-progress in its own frame).
    const watch = () => requestAnimationFrame(check);
    const check = () => {
      if (played || Number(stage.style.getPropertyValue("--door-progress")) < OPEN) return;
      played = true;
      removeEventListener("scroll", watch);
      if (!ready) return done();
      try { localStorage.setItem(SEEN, "1"); } catch { /* It may play again next time. */ }
      element.dataset.played = "true";
      // The words wait for the courtyard to be whole; only the picture of them waits, a reader has them throughout.
      stage.dataset.assembling = "playing";
      // The whole painting is the ground and the far sheet stands on it from the start, so the arch is never empty anywhere;
      // each nearer sheet stands up onto its own place in it.
      const turns = images.slice(2).map((image, index) => image.animate(
        // While it stands it throws its hard shadow down onto the sheet behind, which tightens into the painting's own resting relief as it lands, so the swap to the painting is exact: light only, no blur.
        [{ transform: "rotateX(60deg)", filter: "drop-shadow(0 14px 0 rgb(46 34 22 / .34))" }, { transform: "none", filter: "drop-shadow(0 0 0 rgb(46 34 22 / 0))" }],
        { duration: STAND, delay: index * NEXT, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
      ));
      void Promise.all(turns.map(turn => turn.finished)).then(done, done);
    };
    addEventListener("scroll", watch, { passive: true });
    watch();
    return () => { removeEventListener("scroll", watch); clearTimeout(leave); delete stage.dataset.assembling; };
  }, [here]);

  if (!here) return null;
  return <div ref={host} className="courtyard-assembly" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element -- the same painting the stage shows, in register under the sheets */}
    <img src="/assets/threshold/courtyard-fresco.webp" alt="" width={1774} height={887} decoding="async" />
    {/* eslint-disable-next-line @next/next/no-img-element -- the sheets are cut at two widths and must stay in register with the painting, pixel for pixel */}
    {sheets.map(sheet => <img key={sheet} src={source(sheet, 1774)} srcSet={`${source(sheet, 960)} 960w, ${source(sheet, 1774)} 1774w`} sizes="100vw" alt="" width={1774} height={887} decoding="async" />)}
  </div>;
}
