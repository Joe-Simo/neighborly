"use client";

import { useEffect, useRef } from "react";
import { sampleYear, YES_GIVEN } from "@/lib/sample-year";
import "./home-year.css";

const whole = new Intl.NumberFormat("en-US");
// The fold a tab is held at until it is in sight: 60° off upright, of the 86° a tab can lie back (home-year.css).
const upright = 1 - 60 / 86;
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
// In the order the work happens.
const figures = [
  { key: "calls", label: "Calls taken", total: sampleYear.calls, say: whole.format },
  { key: "requests", label: "Requests for help", total: sampleYear.requests, say: whole.format },
  { key: "visits", label: "Home visits, in pairs", total: sampleYear.visits, say: whole.format },
  { key: "paid", label: "Paid direct, never in cash", total: sampleYear.helpPaid / 100, say: dollars.format },
] as const satisfies readonly { key: string; label: string; total: number; say: (value: number) => string }[];

/**
 * The year, folded up: four figures of the sample conference's own year, each cut into the page and standing up out of it
 * as the book's page turns, one after another, hinged at its foot. The figure is always the whole number, crisp and
 * selectable; only its fold follows the scroll. Without script, with Reduce Motion, or already past, they simply stand.
 * The visitor's yes adds one request.
 */
export function HomeYear() {
  const root = useRef<HTMLDListElement>(null);
  useEffect(() => {
    const list = root.current;
    const panel = list?.closest<HTMLElement>(".relief-panel");
    if (!list || !panel) return;
    const cells = [...list.querySelectorAll<HTMLElement>(":scope > div")];
    const requests = list.querySelector<HTMLElement>("[data-figure=requests]");
    const given = () => { if (requests) requests.textContent = whole.format(sampleYear.requests + 1); list.dataset.oneMore = "true"; };
    if (document.documentElement.dataset.yesGiven === "true") given();
    window.addEventListener(YES_GIVEN, given);
    const stand = () => { cells.forEach(cell => cell.style.removeProperty("--fold")); list.dataset.folding = "false"; };
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { stand(); return () => window.removeEventListener(YES_GIVEN, given); }
    let frame = 0, near = false, last = "";
    const follow = () => {
      frame = 0;
      // No figure is ever seen more than 60° off upright: each tab lies at 60° until it is in sight, then stands.
      // Under a turned page (chapter-sheets.tsx sets --turned), a tab is in sight once the crease, travelling from the lower right corner
      // along the window's diagonal, has passed its own nearest corner; it stands by the time the crease is a quarter of the way past its far one.
      // Where no page is turned, it stands as it rises into the window, each a little after the one before.
      const turned = panel.dataset.turn === "to" ? panel.style.getPropertyValue("--turned") : "";
      const w = innerWidth, h = innerHeight, far = Math.hypot(w, h);
      const along = (x: number, y: number) => ((w - x) * w + (h - y) * h) / far;
      const rise = Math.max(0, Math.min(1, (h - list.getBoundingClientRect().top) / (h * .55)));
      const folds = cells.map((cell, index) => {
        let t: number;
        if (turned && Number(turned) >= 1) t = 1;
        else if (turned) {
          const box = cell.getBoundingClientRect(), gone = far * Number(turned), from = along(box.right, box.bottom), to = along(box.left, box.top) + far * .25;
          t = (gone - from) / (to - from);
        } else t = (rise - .15 - index * .1) / .45;
        t = Math.max(0, Math.min(1, t));
        return upright + (1 - upright) * (1 - (1 - t) ** 3);
      });
      const key = folds.map(fold => fold.toFixed(3)).join();
      if (key !== last) {
        last = key;
        const standing = folds.every(fold => fold >= 1);
        list.dataset.folding = String(!standing);
        cells.forEach((cell, index) => cell.style.setProperty("--fold", folds[index].toFixed(3)));
      }
      if (near) frame = requestAnimationFrame(follow);
    };
    const watch = new IntersectionObserver(entries => { near = entries.some(entry => entry.isIntersecting); if (near && !frame) frame = requestAnimationFrame(follow); });
    // The figures themselves are watched, not their chapter: held under a turned page, they can be in the window while the chapter's own box is not.
    watch.observe(list);
    follow();
    return () => { cancelAnimationFrame(frame); watch.disconnect(); window.removeEventListener(YES_GIVEN, given); };
  }, []);
  return <>
    <dl className="home-year" ref={root}>
      {figures.map(figure => <div key={figure.key}>
        <dt>{figure.label}</dt>
        <dd><span className="home-year-tab"><span data-figure={figure.key}>{figure.say(figure.total)}</span></span></dd>
      </div>)}
    </dl>
    <p className="home-year-note">From the sample conference. Every person in it is made up.</p>
  </>;
}
