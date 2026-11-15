"use client";

import { useEffect, useRef } from "react";
import "./relief-journey.css";

const story = [
  { picture: "call", title: "The call.", copy: "Someone rings the help line. The message is kept, and someone is always next to call back." },
  { picture: "visit", title: "The visit.", copy: "Two members go to the home, together, and listen." },
  { picture: "help", title: "The help.", copy: "The conference agrees. The bill is paid straight to the landlord or the utility." },
  { picture: "year", title: "The year.", copy: "Every call, visit and dollar adds itself up for the yearly report." },
] as const;

// Each wave is one cut sheet, in the shapes of the doors' own panels. They stand in until the painted picture arrives.
const waves = [
  ["M-6 37C10 23 25 46 44 35S78 18 106 30V52C84 41 66 60 46 52S14 43-6 58Z", "M-6 49C13 39 29 61 50 50S84 37 106 46V70H-6Z"],
  ["M-6 28C14 40 30 15 52 27S86 40 106 24V46C86 58 70 36 50 47S16 58-6 46Z", "M-6 52C12 62 34 40 54 51S88 60 106 48V70H-6Z"],
  ["M-6 41C12 27 28 49 48 38S82 22 106 35V55C86 44 66 63 48 55S12 47-6 60Z", "M-6 47C16 37 32 58 52 48S86 36 106 45V70H-6Z"],
  ["M-6 26C16 38 32 14 54 26S88 38 106 23V44C88 56 70 35 52 46S14 56-6 44Z", "M-6 54C14 63 36 42 56 52S88 61 106 50V70H-6Z"],
] as const;

/** What a conference does with Kind Helps, one idea to a screen, joined by one ochre thread. */
export function ReliefStory() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const panels = [...element.querySelectorAll<HTMLElement>(".relief-panel")];
    let raf = 0;
    const update = () => {
      raf = 0;
      const height = innerHeight;
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom < -height || bounds.top > height * 2) return;
      // The thread is drawn as far as the middle of the screen has reached.
      element.style.setProperty("--thread", Math.max(0, Math.min(1, (height * .55 - bounds.top) / bounds.height)).toFixed(4));
      // A panel's layers settle as it rises into place: 1 at the foot of the screen, 0 once it is a third of the way up.
      for (const panel of panels) panel.style.setProperty("--e", Math.max(0, Math.min(1, (panel.getBoundingClientRect().top - height * .3) / (height * .7))).toFixed(4));
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); };
  }, []);
  return <section ref={root} className="relief-story" aria-label="What a conference does with Kind Helps">
    <svg className="relief-thread relief-thread-desk" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} d="M50 0C50 22 45.6 28 45.6 50S54.4 122 54.4 150S45.6 222 45.6 250S54.4 322 54.4 350S50 380 50 400" /></svg>
    <svg className="relief-thread relief-thread-phone" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} d="M2.6 0C4.6 50 .6 100 2.6 150S4.6 250 2.6 300S.6 370 2.6 400" /></svg>
    {story.map((part, index) => <article key={part.picture} className="relief-panel" data-side={index % 2 ? "left" : "right"}>
      <div className="relief-words"><h2>{part.title}</h2><p>{part.copy}</p></div>
      <div className="relief-picture" data-placeholder={`relief-${part.picture}`} aria-hidden="true">
        <svg className="relief-layer-far" viewBox="0 0 100 66.667" preserveAspectRatio="none"><path fill="#6f5f93" d={waves[index][0]} /></svg>
        <svg className="relief-layer-near" viewBox="0 0 100 66.667" preserveAspectRatio="none"><path fill="#365c46" d={waves[index][1]} /></svg>
      </div>
    </article>)}
  </section>;
}
