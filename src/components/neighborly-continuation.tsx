"use client";

import Link from "next/link";

import { useEffect, useRef, type CSSProperties } from "react";
import { releaseFarLayers } from "@/lib/far-layers";
import { FrescoThreshold } from "./fresco-threshold";
import { ReliefStory } from "./relief-story";
import { HomeYes } from "./home-yes";
import { YearPaper } from "./year-paper";
import { ThreadCard } from "./thread-card";
import { ChapterSheet } from "./chapter-sheets";
import { ReliefLean } from "./relief-lean";
import { ClosingBand } from "./public-ending";
import { Colophon } from "./public-foot";
import { SampleLink } from "./sample-link";
import { useSettled } from "@/lib/use-settled";
import "./neighborly-continuation.css";
import "./rooms.css";
import "./cut-edges.css";

/** Everything after the opening: through the doors, the story of the work, and the way in. */
/** How wide each room's picture stands (measured 360 to 2560): about 38% of a phone, 43% of a tablet, under 30% of a wide screen. A phone at 3x takes the 448, every other screen the 728. */
const cuts = (picture: string, type: string) => [448, 728, 960].map(width => `/assets/relief/relief-${picture}-detail-${width}.${type} ${width}w`).join();
const detailSizes = "(max-width: 700px) 38vw, (max-width: 1023px) 43vw, 30vw";

// What a conference has on its first day, in the order the work happens. Each line lies under its room's own picture,
// set at the small angle it was put down at.
const rooms = [
  ["call", "The help line", "Every call is written down once, and the urgent ones rise to the top.", -1],
  ["visit", "Visits in pairs", "What the two members saw, and what was asked, stays with the request.", .9],
  ["help", "The ledger", "Every bill paid is on one page: to whom, for whom, and how much.", -.8],
  ["year", "The yearly report", "Ready when the year ends. Check the totals, then print.", 1.1],
  ["people", "Your people", "Each member sees what they said yes to, in English or Spanish.", -1.1],
  ["files", "The assistant", "It checks the draft request made from a call note. A\u00a0person decides on every one.", .8],
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
    // The painted layers of every chapter on the page are let go while far from the reader (far-layers.ts).
    const release = releaseFarLayers(document, ".relief-picture, .neighborly-together-paper, .neighborly-close-art");
    return () => { observer.disconnect(); release(); };
  }, []);
  return <div className="neighborly-continuation" id="neighborly-courtyard" ref={root}>
    <FrescoThreshold />
    <noscript>
      {/* The page is laid out as the scrolling journey from its first paint, so nothing moves when the script arrives; without script it is a plain stacked page. */}
      <style>{`.fresco-journey{display:none!important}.painted-world-track{height:auto!important;pointer-events:auto!important}.painted-world-viewport{position:relative!important;opacity:1!important}.neighborly-continuation{margin-top:0!important}.neighborly-connected-world::after{display:none!important}.painted-world-scroll-cue{display:none!important}`}</style>
      <section className="neighborly-static-story" aria-label="The courtyard">
        {/* A native image keeps the courtyard available without client-side code. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/threshold/courtyard-fresco.webp" width="1774" height="887" alt="A sunlit church courtyard, with a woman preparing food at a shared table." />
        <p>Faith, <em>lived out.</em></p>
      </section>
    </noscript>
    <ThreadCard />
    <ChapterSheet to="story" />
    <ReliefStory />
    <ReliefLean />
    <HomeYes />
    <YearPaper />
    <section id="how-neighborly-works" tabIndex={-1} className="neighborly-together" aria-labelledby="together-title">
      <div className="neighborly-together-paper" data-settled={settled} aria-hidden="true" />
      <ChapterSheet to="close" />
      {/* The rooms are a part of their own, named by their sentence, which is their heading: the six room names are read under it, not under "Your turn." */}
      <div className="neighborly-rooms" data-reveal role="region" aria-labelledby="rooms-title">
        <div>
          <p className="neighborly-rooms-kicker">The rooms</p>
          <p className="neighborly-together-statement" id="rooms-title" role="heading" aria-level={2}>One place for a call for help, from the first message to the visit, the bill and the year’s report.</p>
        </div>
        <ul aria-label="What your conference gets">
          {rooms.map(([picture, title, line, turn], index) => <li key={title} style={{ "--turn": `${turn}deg`, "--i": index } as CSSProperties}>
            <picture>
              {/* A close detail of the room's relief, hand and object only, so no card repeats the story's pictures above it. */}
              <source type="image/avif" srcSet={cuts(picture, "avif")} sizes={detailSizes} />
              <img src={`/assets/relief/relief-${picture}-detail-728.webp`} srcSet={cuts(picture, "webp")} sizes={detailSizes} width={728} height={485} alt="" loading="lazy" decoding="async" />
            </picture>
            <div>
              <h3>{title}</h3>
              <p>{line}</p>
            </div>
          </li>)}
        </ul>
      </div>
      <ReliefLean within=".neighborly-rooms" />
      {/* Whose it is, and where it lives: plain facts, each backed in claims-audit.md. Still paper, no picture. */}
      <div className="neighborly-trust" role="region" aria-labelledby="trust-title">
        <h2 id="trust-title">Whose it is, and where it lives.</h2>
        <p>Kind Helps is independent and free, and it is not affiliated with the Society of St. Vincent de Paul. Only people invited into a conference can see its work, and a neighbor’s record opens only to the owner and coordinators. A neighbor’s name, phone and address are taken out before anything reaches the assistant, and no request is saved without a person’s yes. The owner can download all of the conference’s records at any time.</p>
        <Link href="/privacy">Privacy</Link>
      </div>
      <ClosingBand />
      <Colophon home="#story-start" Sample={SampleLink} />
    </section>
  </div>;
}
