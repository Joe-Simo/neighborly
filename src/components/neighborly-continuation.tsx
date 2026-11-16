"use client";

import { useEffect, useRef } from "react";
import { FrescoThreshold } from "./fresco-threshold";
import { ReliefStory } from "./relief-story";
import { HomeYes } from "./home-yes";
import { ClosingBand, Colophon } from "./public-ending";
import { useSettled } from "@/lib/use-settled";
import "./neighborly-continuation.css";

/** Everything after the opening: through the doors, the story of the work, and the way in. */
// What a conference has on its first day, in the order the work happens.
const gets = [
  ["The help line", "Every call is written down once, and the urgent ones rise to the top."],
  ["Visits in pairs", "What the two members saw, and what was asked, stays with the request."],
  ["The ledger", "Every bill paid is on one page: to whom, for whom, and how much."],
  ["The yearly report", "The totals are kept as the work is done. Check them, then print."],
  ["Your people", "Each member sees what they said yes to, in English or Spanish."],
  ["The assistant", "It drafts a request from the call note. A person checks every one."],
  ["Free", "For every conference. There is nothing to buy."],
] as const;

export function NeighborlyContinuation() {
  const root = useRef<HTMLDivElement>(null);
  const settled = useSettled();
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const element = root.current;
    element?.classList.add("has-reveal");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }, { threshold: .12 });
    element?.querySelectorAll("[data-reveal]").forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  return <div className="neighborly-continuation" id="neighborly-courtyard" ref={root}>
    <FrescoThreshold />
    <noscript>
      {/* The page is laid out as the scrolling journey from its first paint, so nothing moves when the script arrives; without script it is a plain stacked page. */}
      <style>{`.fresco-journey{display:none!important}.painted-world-track{height:auto!important;pointer-events:auto!important}.painted-world-viewport{position:relative!important;opacity:1!important}.neighborly-continuation{margin-top:0!important}.neighborly-connected-world::after{display:none!important}`}</style>
      <section className="neighborly-static-story" aria-label="The courtyard">
        {/* A native image keeps the courtyard available without client-side code. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/threshold/courtyard-fresco.webp" width="1774" height="887" alt="A sunlit church courtyard, with a woman preparing food at a shared table." />
        <p>Faith, <em>lived out.</em></p>
      </section>
    </noscript>
    <ReliefStory />
    <HomeYes />
    <section id="how-neighborly-works" tabIndex={-1} className="neighborly-together" aria-labelledby="together-title">
      <div className="neighborly-together-paper" data-settled={settled} aria-hidden="true" />
      <div className="neighborly-together-bottom" data-reveal>
        <p className="neighborly-together-statement">One place to answer every call for help, from the first message to the visit, the bill and the year’s report.</p>
        <ul className="neighborly-gets" aria-label="What your conference gets">
          {gets.map(([title, line]) => <li key={title}><h3>{title}</h3><p>{line}</p></li>)}
        </ul>
      </div>
      <ClosingBand />
      <Colophon home="#story-start" />
    </section>
  </div>;
}
