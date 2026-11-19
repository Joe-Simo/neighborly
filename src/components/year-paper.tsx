"use client";

import { useEffect, useRef } from "react";
import { frameStep } from "@/lib/scroll-frame";
import { viewport } from "@/lib/viewport";
import { sampleYear } from "@/lib/sample-year";
import { FIRST_MONTH, MONTHS, monthAt, SLIPS } from "@/lib/year-paper";
import { yearPaperWords } from "@/lib/year-paper-words";
import type { YearPaperCanvas } from "./year-paper-gl";
import "./year-paper.css";

const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const months = Array.from({ length: MONTHS }, (_, month) => monthName.format(new Date(FIRST_MONTH).setUTCMonth(new Date(FIRST_MONTH).getUTCMonth() + month)));
const words = yearPaperWords.en;
const whole = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * The year in paper: after the chapters, the sample conference's year as one slip for every request, fanned a month at a time in depth.
 * The scroll flies the reader down the stack and each month's leaf turns away overhead; the flight ends on the year's total, as Reports adds it up.
 * The first frame is a poster drawn from the same numbers (scripts/year-paper-posters.mts); the canvas is loaded only once the band is near,
 * and takes the poster's place by a cut once it has drawn the same frame. Every word is the page's own text, beside the slips, never on them.
 * With Reduce Motion, or without script, the poster is the flight's end and nothing moves.
 */
export function YearPaper() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const band = root.current, frame = band?.querySelector<HTMLElement>(".year-paper-window"), month = band?.querySelector<HTMLElement>(".year-paper-month"), run = band?.querySelector<HTMLElement>(".year-paper-run");
    if (!band || !frame || !month || !run || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let scene: YearPaperCanvas | null = null, gone = false, top = 0, tall = 0, near = false, drawn = -1, shown = 0;
    const read = () => { const box = run.getBoundingClientRect(); top = box.top; tall = box.height; };
    const write = () => {
      if (!near) return;
      const through = Math.max(0, Math.min(1, -top / Math.max(1, tall - viewport.height)));
      const at = monthAt(through);
      if (at !== shown) month.textContent = months[shown = at];
      // Drawn to the thousandth of the flight, so a still page or a scroll too small to see draws nothing.
      const step = Math.round(through * 1000);
      if (scene && step !== drawn) { scene.draw(step / 1000); drawn = step; if (band.dataset.live !== "true") band.dataset.live = "true"; }
    };
    const { ask, drop } = frameStep(read, write);
    let sized: ResizeObserver | undefined;
    const load = async () => {
      const { yearPaperCanvas } = await import("./year-paper-gl");
      const canvas = document.createElement("canvas");
      canvas.className = "year-paper-canvas";
      canvas.setAttribute("aria-hidden", "true");
      const made = await yearPaperCanvas(canvas, () => gone);
      if (!made || gone) return made?.dispose();
      // The first frame is drawn while the canvas is still off the page, in idle time; it joins the page, over the poster, already drawn.
      const box = frame.getBoundingClientRect();
      made.size(box.width, box.height);
      read();
      made.draw(Math.max(0, Math.min(1, -top / Math.max(1, tall - viewport.height))));
      frame.append(canvas);
      scene = made;
      sized = new ResizeObserver(([entry]) => { scene?.size(entry.contentRect.width, entry.contentRect.height); drawn = -1; ask(); });
      // The canvas is over the poster from here: the cut is now, with the poster's own frame on it.
      band.dataset.live = "true";
      sized.observe(frame);
    };
    // Asked for well before it is reached, never on first paint: a window and a half ahead.
    const ahead = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { ahead.disconnect(); void load(); } }, { rootMargin: "150% 0px" });
    const inSight = new IntersectionObserver(entries => { near = entries.some(entry => entry.isIntersecting); if (near) ask(); });
    ahead.observe(band);
    inSight.observe(run);
    addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
    return () => { gone = true; drop(); ahead.disconnect(); inSight.disconnect(); sized?.disconnect(); scene?.dispose(); removeEventListener("scroll", ask); removeEventListener("resize", ask); };
  }, []);

  return <section ref={root} className="year-paper" data-live="false" aria-labelledby="year-paper-title">
    <div className="year-paper-run">
    <div className="year-paper-stage">
      <figure className="year-paper-figure">
        <div className="year-paper-window">
          <picture>
            <source media="(prefers-reduced-motion: reduce) and (min-width: 768px)" srcSet="/assets/home/year-paper-wide-end.svg" />
            <source media="(prefers-reduced-motion: reduce)" srcSet="/assets/home/year-paper-tall-end.svg" />
            <source media="(min-width: 768px)" srcSet="/assets/home/year-paper-wide-start.svg" />
            <img src="/assets/home/year-paper-tall-start.svg" alt="" width={600} height={800} loading="lazy" decoding="async" />
          </picture>
        </div>
        <figcaption>
          <h2 id="year-paper-title" className="year-paper-title">{words.title}</h2>
          <p>{words.lead}</p>
          <p className="year-paper-month" aria-hidden="true">{months[0]}</p>
        </figcaption>
      </figure>
    </div>
    </div>
    <div className="year-paper-total">
      <p className="year-paper-count"><span>{whole.format(SLIPS)}</span> {words.requests}</p>
      <dl>
        <div><dt>{words.calls}</dt><dd>{whole.format(sampleYear.calls)}</dd></div>
        <div><dt>{words.visits}</dt><dd>{whole.format(sampleYear.visits)}</dd></div>
        <div><dt>{words.paid}</dt><dd>{dollars.format(sampleYear.helpPaid / 100)}</dd></div>
      </dl>
      <p className="year-paper-note">{words.note}</p>
    </div>
  </section>;
}
