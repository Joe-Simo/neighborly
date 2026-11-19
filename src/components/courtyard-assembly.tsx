"use client";

import { whenIdle } from "@/lib/idle";
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
      leave = window.setTimeout(() => whenIdle(() => setOver(true), 2000), 1000);
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
      // The ground is bare paper with the far sheet standing on it, and each nearer sheet's slot cut in it from its own outline
      // (courtyard-slots, made from the sheets' alpha): a pop-up, each piece standing up into the slot it came from.
      // While a sheet stands it throws its hard shadow down onto the sheet behind: a dark copy of its own outline under it, moved and
      // faded on the compositor only, which tightens into the painting's own resting relief as it lands, so the swap is exact. No blur.
      const timing = (index: number) => ({ duration: STAND, delay: index * NEXT, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" as const });
      const turns = [...element.querySelectorAll<HTMLElement>(".courtyard-rise")].flatMap((rise, index) => [
        rise.querySelector("img")!.animate([{ transform: "rotateX(60deg)" }, { transform: "none" }], timing(index)),
        rise.querySelector("i")!.animate([{ transform: "translateY(14px) rotateX(60deg)", opacity: .34 }, { transform: "none", opacity: 0 }], timing(index)),
      ]);
      void Promise.all(turns.map(turn => turn.finished)).then(done, done);
    };
    addEventListener("scroll", watch, { passive: true });
    watch();
    return () => { removeEventListener("scroll", watch); clearTimeout(leave); delete stage.dataset.assembling; };
  }, [here]);

  if (!here) return null;
  // One width for the sheets and their shadows alike, so each shadow is its sheet's outline exactly.
  const width = innerWidth * devicePixelRatio > 1100 ? 1774 : 960;
  return <div ref={host} className="courtyard-assembly" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element -- the slots, cut from the sheets' own outlines, in register with them */}
    <img src={`/assets/made/courtyard-slots-${width}.webp`} alt="" width={1774} height={887} decoding="async" />
    {/* eslint-disable-next-line @next/next/no-img-element -- the sheets are cut at two widths and must stay in register with the painting, pixel for pixel */}
    <img src={source(sheets[0], width)} alt="" width={1774} height={887} decoding="async" />
    {/* Each nearer sheet with its shadow under it, both drawn and composited at their starting lie before anything plays. */}
    {sheets.slice(1).map(sheet => <span key={sheet} className="courtyard-rise">
      <i style={{ maskImage: `url(${source(sheet, width)})`, WebkitMaskImage: `url(${source(sheet, width)})` }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
      <img src={source(sheet, width)} alt="" width={1774} height={887} decoding="async" />
    </span>)}
  </div>;
}
