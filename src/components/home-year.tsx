"use client";

import { viewport } from "@/lib/viewport";
import { frameStep } from "@/lib/scroll-frame";
import { type CSSProperties, useEffect, useRef } from "react";
import { whenIdle } from "@/lib/idle";
import { sampleYear, YES_GIVEN } from "@/lib/sample-year";
import { HomeYearSlip, ROSA_HELP, finals as rosaFinals } from "./home-year-slip";
import "./home-year.css";

const whole = new Intl.NumberFormat("en-US");
// The fold a tab is held at until it is in sight: 60° off upright, of the 86° a tab can lie back (home-year.css).
const upright = 1 - 60 / 86;
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
// In the order the work happens.
const figures = [
  // Rosa's week is the year's last: each pile waits for its part of it (home-year-slip.tsx), and laying the three down completes the year.
  { key: "calls", label: "Calls taken", total: sampleYear.calls - 1, say: whole.format, each: 10 },
  { key: "requests", label: "Requests for help", total: sampleYear.requests, say: whole.format, each: 10 },
  { key: "visits", label: "Home visits, in pairs", total: sampleYear.visits - 1, say: whole.format, each: 10 },
  { key: "paid", label: "Paid direct, never in cash", total: sampleYear.helpPaid / 100 - ROSA_HELP, say: dollars.format, each: 0 },
] as const satisfies readonly { key: string; label: string; total: number; say: (value: number) => string; each: number }[];

/** A hand-squared pile: each sheet sits a little off true, the same way on every visit. */
// Hashed per sheet rather than stepped, so no rhythm repeats inside a pile.
const jitter = (figure: number, sheet: number) => {
  let h = Math.imul(sheet + 1, 0x9e3779b1) ^ Math.imul(figure + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (((h ^ (h >>> 13)) >>> 0) % 9 - 4) / 2;
};

/**
 * The whole pile as one picture, drawn once: every sheet a 3px strip with its edge line, set its few pixels off true at both ends
 * (each drawn as two halves, one held from the left and one from the right). The stack's height shows whole sheets only.
 */
const pile = (place: number, sheets: number) => {
  const strip = (j: number, y: number, h: number, paint: string) => `<rect x='${4 + j}' y='${y}' width='50%25' height='${h}' ${paint}/><rect x='50%25' y='${y}' width='50%25' height='${h}' transform='translate(${j - 4} 0)' ${paint}/>`;
  const strips = Array.from({ length: sheets }, (_, sheet) => { const y = (sheets - 1 - sheet) * 3, j = jitter(place, sheet); return strip(j, y, 3, "fill='%23f7f2e6'") + strip(j, y + 2, 1, "fill='%23b0a084'"); }).join("");
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100%25' height='${sheets * 3}'>${strips}</svg>")`;
};

/**
 * The year, folded up: four figures of the sample conference's own year, each cut into the page and standing up out of it
 * as the book's page turns, one after another, hinged at its foot. The figure is always the whole number, crisp and
 * selectable; only its fold follows the scroll. Without script, with Reduce Motion, or already past, they simply stand.
 * The visitor's yes completes the year with Rosa's help.
 */
export function HomeYear() {
  const root = useRef<HTMLDListElement>(null);
  useEffect(() => {
    const list = root.current;
    const panel = list?.closest<HTMLElement>(".relief-panel");
    if (!list || !panel) return;
    const cells = [...list.querySelectorAll<HTMLElement>(":scope > div")];
    // Each pile's picture is decoded while the page is idle, well before the turn that lays it.
    whenIdle(() => list.querySelectorAll<HTMLElement>(".home-year-stack>i").forEach(stack => {
      const source = /url\("(.*)"\)/.exec(getComputedStyle(stack).backgroundImage)?.[1];
      if (source) { const picture = new Image(); picture.src = source; void picture.decode().catch(() => {}); }
    }));
    // The yes is Rosa's help: her call, her visit and her $450 complete the year, to the figures Reports gives. Requests already count hers.
    const given = () => { for (const [key, value] of Object.entries(rosaFinals)) { const figure = list.querySelector<HTMLElement>(`[data-figure=${key}]`); if (figure) figure.textContent = value; } list.dataset.oneMore = "true"; };
    if (document.documentElement.dataset.yesGiven === "true") given();
    window.addEventListener(YES_GIVEN, given);
    const stand = () => { cells.forEach(cell => { cell.style.removeProperty("--fold"); cell.style.removeProperty("--laid"); }); list.dataset.folding = "false"; };
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { stand(); return () => window.removeEventListener(YES_GIVEN, given); }
    let near = false, last = "", listTop = 0, cellBoxes: DOMRect[] = [];
    // Read in the shared frame's first half, before any part of the page has written (scroll-frame.ts).
    const read = () => { listTop = list.getBoundingClientRect().top; cellBoxes = panel.dataset.turn === "to" ? cells.map(cell => cell.getBoundingClientRect()) : []; };
    const follow = () => {
      // No figure is ever seen more than 60° off upright: each tab lies at 60° until it is in sight, then stands.
      // Under a turned page (chapter-sheets.tsx sets --turned), a tab is in sight once the crease, travelling from the lower right corner
      // along the window's diagonal, has passed its own nearest corner; it stands by the time the crease is a quarter of the way past its far one.
      // Where no page is turned, it stands as it rises into the window, each a little after the one before.
      const turned = panel.dataset.turn === "to" ? panel.style.getPropertyValue("--turned") : "";
      const w = viewport.width, h = viewport.height, far = Math.hypot(w, h);
      const along = (x: number, y: number) => ((w - x) * w + (h - y) * h) / far;
      const rise = Math.max(0, Math.min(1, (h - listTop) / (h * .55)));
      const folds = cells.map((cell, index) => {
        let t: number;
        if (turned && Number(turned) >= 1) t = 1;
        else if (turned) {
          const box = cellBoxes[index] ?? cell.getBoundingClientRect(), gone = far * Number(turned), from = along(box.right, box.bottom), to = along(box.left, box.top) + far * .25;
          t = (gone - from) / (to - from);
        } else t = (rise - .15 - index * .1) / .45;
        t = Math.max(0, Math.min(1, t));
        return upright + (1 - upright) * (1 - (1 - t) ** 3);
      });
      // Whether all stand is part of the key: a last step from .9996 to 1 rounds to the same figures, and must still put the cut edges away.
      const standing = folds.every(fold => fold >= 1);
      const key = folds.map(fold => fold.toFixed(3)).join() + standing;
      if (key !== last) {
        last = key;
        list.dataset.folding = String(!standing);
        cells.forEach((cell, index) => {
          cell.style.setProperty("--fold", folds[index].toFixed(3));
          // The stack is laid a whole sheet at a time as its figure stands up: every sheet is set down, none is grown.
          const sheets = Number(cell.dataset.sheets);
          if (sheets) cell.style.setProperty("--laid", String(Math.round(sheets * (folds[index] - upright) / (1 - upright))));
        });
      }
      if (near) step.ask();
    };
    const step = frameStep(read, follow);
    const watch = new IntersectionObserver(entries => { near = entries.some(entry => entry.isIntersecting); if (near) step.ask(); });
    // The figures themselves are watched, not their chapter: held under a turned page, they can be in the window while the chapter's own box is not.
    watch.observe(list);
    read();
    follow();
    return () => { step.drop(); watch.disconnect(); window.removeEventListener(YES_GIVEN, given); };
  }, []);
  return <>
    <dl className="home-year" ref={root}>
      {figures.map((figure, place) => {
        // Only the counts are stacked, one sheet for every ten, so the three stand true to one another; money is not a pile of the same paper.
        // The top sheet is the part-full one.
        const sheets = figure.each ? Math.ceil(figure.total / figure.each) : 0;
        return <div key={figure.key} data-sheets={sheets} style={sheets ? { "--sheets": sheets } as CSSProperties : undefined}>
        <dt>{figure.label}</dt>
        <dd>
          {sheets > 0 && <><span className="home-year-stack" aria-hidden="true"><i style={{ backgroundImage: pile(place, sheets) }} /></span><span className="home-year-foot" aria-hidden="true" /></>}
          <span className="home-year-tab"><span data-figure={figure.key}>{figure.say(figure.total)}</span></span>
        </dd>
      </div>;
      })}
    </dl>
    <HomeYearSlip />
    <p className="home-year-note">From the sample conference. Every person in it is made up.</p>
  </>;
}
