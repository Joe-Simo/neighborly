"use client";

import { useEffect, useMemo, useRef } from "react";
import { frameStep } from "@/lib/scroll-frame";
import { viewport } from "@/lib/viewport";
import { FIRST_MONTH, MONTHS, monthAt } from "@/lib/year-paper";
import { yearPaperWords } from "@/lib/year-paper-words";
import type { Language } from "@/lib/words";
import { numberLocales } from "@/lib/words/numbers";
import type { YearPaperCanvas } from "./year-paper-gl";
import "./year-paper.css";

/** Everything the band says, in one language: its words, its twelve months and its figures (es-US, as every Spanish page writes them). */
const sayings = (language: Language) => {
  const locale = numberLocales[language];
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const first = new Date(FIRST_MONTH);
  // Spanish months are lowercase in running text; standing alone as a label they open with a capital, as a heading does.
  const months = Array.from({ length: MONTHS }, (_, month) => { const name = monthName.format(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + month, 1)); return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1); });
  return { words: yearPaperWords[language], months };
};

/**
 * The year in paper: after the chapters, the sample conference's year as one slip for every request, fanned a month at a time in depth.
 * The scroll flies the reader down the stack and each month's leaf turns away overhead; then the camera draws back and the band ends on all twelve months in their fans. Its figures are the next chapter's, "The year.", and are said only there.
 * The first frame is a poster drawn from the same numbers (scripts/year-paper-posters.mts); the canvas is loaded only once the band is near,
 * and takes the poster's place by a cut once it has drawn the same frame. Live, the canvas fills the whole stage: the window frames the picture, and the slips
 * run on past it to the screen's own edges, so paper never ends on a straight crop; the caption keeps its own sheet over them. Every word is the page's own text, beside the slips, never on them.
 * With Reduce Motion, or without script, the poster is the flight's end and nothing moves.
 */
export function YearPaper({ language = "en" }: { language?: Language }) {
  const { words, months } = useMemo(() => sayings(language), [language]);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const band = root.current, frame = band?.querySelector<HTMLElement>(".year-paper-window"), stage = band?.querySelector<HTMLElement>(".year-paper-stage"), month = band?.querySelector<HTMLElement>(".year-paper-month"), run = band?.querySelector<HTMLElement>(".year-paper-run");
    if (!band || !frame || !stage || !month || !run || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
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
      const measure = () => {
        const outer = stage.getBoundingClientRect(), box = frame.getBoundingClientRect();
        return { width: outer.width, height: outer.height, window: { x: box.left - outer.left, y: box.top - outer.top, w: box.width, h: box.height } };
      };
      made.size(measure());
      read();
      made.draw(Math.max(0, Math.min(1, -top / Math.max(1, tall - viewport.height))));
      stage.prepend(canvas);
      scene = made;
      sized = new ResizeObserver(() => { scene?.size(measure()); drawn = -1; ask(); });
      // The canvas is over the poster from here: the cut is now, with the poster's own frame on it.
      band.dataset.live = "true";
      sized.observe(stage); sized.observe(frame);
    };
    // Asked for well before it is reached, never on first paint: a window and a half ahead.
    const ahead = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { ahead.disconnect(); void load(); } }, { rootMargin: "150% 0px" });
    const inSight = new IntersectionObserver(entries => { near = entries.some(entry => entry.isIntersecting); if (near) ask(); });
    ahead.observe(band);
    inSight.observe(run);
    addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
    return () => { gone = true; drop(); ahead.disconnect(); inSight.disconnect(); sized?.disconnect(); scene?.dispose(); removeEventListener("scroll", ask); removeEventListener("resize", ask); };
  }, [months]);

  return <section ref={root} className="year-paper" data-live="false" aria-labelledby="year-paper-title" lang={language === "en" ? undefined : language}>
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
  </section>;
}
