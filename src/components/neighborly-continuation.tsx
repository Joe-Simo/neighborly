"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrescoThreshold } from "./fresco-threshold";
import { ReliefStory } from "./relief-story";
import { useSettled } from "@/lib/use-settled";
import "./neighborly-continuation.css";

/** Everything after the opening: through the doors, the story of the work, and the way in. */
// What a conference has on its first day, in the order the work happens.
const gets = [
  ["The help line", "Every call is written down once. The urgent ones rise to the top, and someone is always next to call back."],
  ["Visits in pairs", "Two members go together. What they saw and what was asked stays with the request."],
  ["The ledger", "Every bill paid is on one page: to whom, for whom, and how much."],
  ["The yearly report", "The year adds itself up, ready for you to check and print."],
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
    <section id="how-neighborly-works" tabIndex={-1} className="neighborly-together" aria-labelledby="together-title">
      <div className="neighborly-together-paper" data-settled={settled} aria-hidden="true" />
      <div className="neighborly-together-bottom" data-reveal>
        <p className="neighborly-together-statement">One place to answer every call for help, from the first message to the visit, the bill and the year’s report.</p>
        <ul className="neighborly-gets" aria-label="What your conference gets">
          {gets.map(([title, line]) => <li key={title}><h3>{title}</h3><p>{line}</p></li>)}
        </ul>
      </div>
      {/* The page closes where it began: the same two people, the card now resting in the open hand. */}
      <div className="neighborly-close">
        <picture className="neighborly-close-art">
          <source media="(max-width:700px) and (orientation:portrait)" srcSet="/assets/living-relief-mobile-accepted.webp" width={780} height={1688} />
          <img src="/assets/living-relief-accepted.webp" width={1440} height={1024} alt="" loading="lazy" decoding="async" />
        </picture>
        <div className="neighborly-close-words">
          <h2 id="together-title">Bring this to<br /><em>your people.</em></h2>
          <div className="neighborly-final-actions">
            <Button asChild className="neighborly-begin"><Link href="/app?intent=sample">Look around a sample conference<ArrowUpRight aria-hidden="true" /></Link></Button>
            <nav className="neighborly-final-links" aria-label="Your own conference">
              <Link href="/app?intent=start">Start your conference<ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/app?intent=signin">Sign in<ArrowUpRight size={16} aria-hidden="true" /></Link>
            </nav>
            <small>Every person in the sample is made up.</small>
          </div>
        </div>
      </div>
      <footer className="neighborly-colophon"><a href="#story-start">kind helps</a><span>Made for the good we can do. <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">Give a gift</a></span></footer>
    </section>
  </div>;
}
