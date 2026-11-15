"use client";

import { useEffect, useRef } from "react";
import "./relief-journey.css";

const story = [
  { picture: "call", title: "The call.", copy: "Someone rings the help line. The message is kept, and someone is always next to call back." },
  { picture: "visit", title: "The visit.", copy: "Two members go to the home, together, and listen." },
  { picture: "help", title: "The help.", copy: "The conference agrees. The bill is paid straight to the landlord or the utility." },
  { picture: "year", title: "The year.", copy: "Every call, visit and dollar adds itself up for the yearly report." },
] as const;

/** What a conference does with Kind Helps, one idea to a screen, each with its own cut-paper picture. */
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
    {story.map((part, index) => <article key={part.picture} className="relief-panel" data-side={index % 2 ? "left" : "right"}>
      <div className="relief-words"><h2>{part.title}</h2><p>{part.copy}</p></div>
      <div className="relief-picture">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/assets/home/relief-${part.picture}-1536.webp`} srcSet={`/assets/home/relief-${part.picture}-768.webp 768w, /assets/home/relief-${part.picture}-1536.webp 1536w`} sizes="(max-width: 820px) 92vw, 56vw" width={1536} height={1024} alt="" loading="lazy" decoding="async" />
      </div>
    </article>)}
  </section>;
}
