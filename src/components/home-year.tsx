"use client";

import { useEffect, useRef } from "react";
import { sampleYear, YES_GIVEN } from "@/lib/sample-year";
import "./home-year.css";

const whole = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
// In the order the work happens. `step` keeps money on whole hundreds while it climbs.
const figures = [
  { key: "calls", label: "Calls taken", total: sampleYear.calls, step: 1, say: whole.format },
  { key: "requests", label: "Requests for help", total: sampleYear.requests, step: 1, say: whole.format },
  { key: "visits", label: "Home visits, in pairs", total: sampleYear.visits, step: 1, say: whole.format },
  { key: "paid", label: "Paid direct, never in cash", total: sampleYear.helpPaid / 100, step: 100, say: dollars.format },
] as const satisfies readonly { key: string; label: string; total: number; step: number; say: (value: number) => string }[];

/**
 * The year, counted: four figures of the sample conference's own year, climbing as the book's page turns and
 * landing as the ribbon settles. They are written whole in the page itself, so without script and with
 * Reduce Motion they simply stand. They only ever go up, and the visitor's yes adds one request.
 */
export function HomeYear() {
  const root = useRef<HTMLDListElement>(null);
  useEffect(() => {
    const list = root.current;
    const panel = list?.closest<HTMLElement>(".relief-panel");
    if (!list || !panel) return;
    const shown = [...list.querySelectorAll<HTMLElement>("[data-count]")];
    const reached = figures.map(() => 0);
    let yes = document.documentElement.dataset.yesGiven === "true" ? 1 : 0;
    const write = (progress: number) => figures.forEach((figure, index) => {
      const extra = figure.key === "requests" ? yes : 0;
      const value = progress >= 1 ? figure.total + extra : Math.floor((figure.total * progress) / figure.step) * figure.step;
      if (value < reached[index]) return;
      reached[index] = value;
      shown[index].textContent = figure.say(value);
    });
    const given = () => { yes = 1; if (reached[1] >= sampleYear.requests) { write(1); list.dataset.oneMore = "true"; } };
    window.addEventListener(YES_GIVEN, given);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Already past it when the page came alive (a reload far down), or asked to hold still: the figures stand as written.
    if (still || panel.getBoundingClientRect().top < innerHeight * .2) { reached.splice(0, 4, ...figures.map(figure => figure.total)); write(1); return () => window.removeEventListener(YES_GIVEN, given); }
    write(0);
    let frame = 0;
    let near = false;
    const follow = () => {
      // The chapter's own act (relief-story.tsx sets --h from the scroll): the count runs through its middle and is done as the ribbon comes to rest.
      const act = Number(getComputedStyle(panel).getPropertyValue("--h")) || 0;
      const progress = Math.max(0, Math.min(1, (act - .2) / .7));
      write(1 - (1 - progress) ** 2);
      frame = near && reached.some((value, index) => value < figures[index].total) ? requestAnimationFrame(follow) : 0;
    };
    const watch = new IntersectionObserver(entries => { near = entries.some(entry => entry.isIntersecting); if (near && !frame) frame = requestAnimationFrame(follow); });
    watch.observe(panel);
    return () => { cancelAnimationFrame(frame); watch.disconnect(); window.removeEventListener(YES_GIVEN, given); };
  }, []);
  return <>
    <dl className="home-year" ref={root}>
      {figures.map(figure => <div key={figure.key}>
        <dt>{figure.label}</dt>
        {/* The finished figure keeps the place, so nothing beside it moves while the count climbs; a reader hears the finished one. */}
        <dd aria-label={figure.say(figure.total)}><span aria-hidden="true">{figure.say(figure.total)}</span><span data-count aria-hidden="true">{figure.say(figure.total)}</span></dd>
      </div>)}
    </dl>
    <p className="home-year-note">From the sample conference. Every person in it is made up.</p>
  </>;
}
