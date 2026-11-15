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
      <style>{`.fresco-journey{display:none!important}`}</style>
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
      <h2 id="together-title" data-reveal>Bring this to<br /><em>your people.</em></h2>
      <div className="neighborly-together-bottom" data-reveal>
        <p>One place to answer every call for help, from the first message to the visit, the bill and the year’s report.</p>
        <div className="neighborly-final-actions">
          <Button asChild className="neighborly-begin"><Link href="/app?intent=sample">Look around a sample conference<ArrowUpRight aria-hidden="true" /></Link></Button>
          <nav className="neighborly-final-links" aria-label="Your own conference">
            <Link href="/app?intent=start">Start your conference<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href="/app?intent=signin">Sign in<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
          <small>Free for every conference. Every person in the sample is made up.</small>
        </div>
      </div>
      <footer className="neighborly-colophon"><a href="#story-start">kind helps</a><span>Made for the good we can do. <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">Give a gift</a></span></footer>
    </section>
  </div>;
}
