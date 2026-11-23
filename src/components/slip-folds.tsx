"use client";

import { useEffect, useRef } from "react";
import { SampleLink } from "@/components/sample-link";
import { frameStep } from "@/lib/scroll-frame";
import { viewport } from "@/lib/viewport";
import "./slip-folds.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * One request's whole way, on one slip, scrubbed by the scroll and back: flat as the call is written down, its top third folded back
 * along the score, and laid one sheet up on the year's pile, its corner still ochre: the yes is the sample's, further down (home-yes-card.tsx). Only two things move, each by its
 * transform alone (the top panel and the slip); the crease's shade and the slip's lift are steps, set by attribute only when they change.
 * The band's height is the stylesheet's, so nothing is measured to lay it out, and its first frame is the flat slip, as it is drawn without script.
 */
export function SlipFolds() {
  const band = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = band.current, slip = element?.querySelector<HTMLElement>(".slip-folds-slip"), panel = element?.querySelector<HTMLElement>(".slip-folds-top");
    if (!element || !slip || !panel || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = element.querySelector<HTMLElement>(".slip-folds-stage");
    let top = 0, tall = 0, held = 0, near = false;
    const set = { fold: "", lift: "", crease: "", risen: "" };
    // Read in the shared frame's first half, before any part of the page has written (scroll-frame.ts).
    const read = () => { const box = element.getBoundingClientRect(); top = box.top; tall = box.height; held = stage?.offsetHeight || viewport.height; near = box.bottom > -viewport.height && box.top < viewport.height * 2; };
    const write = () => {
      if (!near) return;
      // The run is the band's length past its held stage: a window's height from 1024 up, the slip's own height below it (slip-folds.css).
      const run = Math.max(1, tall - held);
      const through = clamp(-top / run);
      // The band's run (slip-folds.css): the fold takes its first 70%, and the slip settles onto the pile in the last 30%.
      const folded = clamp(through / .7), risen = clamp((through - .7) / .3);
      const fold = `rotateX(${(180 * folded).toFixed(2)}deg)`, lift = `translate3d(0,${(-10 * risen).toFixed(2)}px,0)`;
      const crease = String(Math.min(3, Math.ceil(folded * 3))), risenStep = String(risen >= .5);
      if (fold !== set.fold) panel.style.transform = set.fold = fold;
      if (lift !== set.lift) slip.style.transform = set.lift = lift;
      if (crease !== set.crease) slip.dataset.crease = set.crease = crease;
      if (risenStep !== set.risen) slip.dataset.risen = set.risen = risenStep;
    };
    const { ask, drop } = frameStep(read, write);
    addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
    ask();
    return () => { drop(); removeEventListener("scroll", ask); removeEventListener("resize", ask); };
  }, []);

  return <div ref={band} className="slip-folds" role="group" aria-labelledby="slip-folds-title">
    <div className="slip-folds-stage">
      <figure className="slip-folds-figure">
        <div className="slip-folds-pile" aria-hidden="true"><i /><i /><i /></div>
        <div className="slip-folds-slip" data-crease="0" data-risen="false">
          <div className="slip-folds-top"><p>St. Example Conference</p></div>
          <div className="slip-folds-body">
            <strong>Rosa Fontaine</strong>{" "}
            <span>Behind on November rent, $450.</span>
          </div>
          <span className="slip-folds-corner" aria-hidden="true" />
        </div>
        <figcaption id="slip-folds-title">Every call is written down once, and the urgent ones rise to the top. <SampleLink className="slip-folds-link">Look around a sample conference</SampleLink></figcaption>
      </figure>
    </div>
  </div>;
}
