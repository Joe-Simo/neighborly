"use client";

import { useEffect, useRef } from "react";
import "./relief-journey.css";

// A picture with pieces is a plate with loose paper lying on it, and the first piece listed makes one small move. One without is a single painting.
const story = [
  { picture: "call", pieces: ["piece"], title: "The call.", copy: "Someone rings the help line. The message is kept, and someone is always next to call back." },
  { picture: "visit", pieces: ["leaf", "hands"], title: "The visit.", copy: "Two members go to the home, together, and listen." },
  { picture: "help", pieces: ["piece"], title: "The help.", copy: "The conference agrees. The bill is paid straight to the landlord or the utility." },
  { picture: "year", pieces: ["piece"], title: "The year.", copy: "Every call, visit and dollar adds itself up for the yearly report." },
] as const;
const sizes = "(max-width: 820px) 92vw, 56vw";
const layer = (name: string, small: number, large: number, type: string) => `/assets/home/relief-${name}-${small}.${type} ${small}w, /assets/home/relief-${name}-${large}.${type} ${large}w`;

/** What a conference does with Kind Helps, one idea to a screen, each with its own cut-paper picture. */
export function ReliefStory() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const panels = [...element.querySelectorAll<HTMLElement>(".relief-panel")];
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const height = innerHeight;
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom < -height || bounds.top > height * 2) return;
      for (const panel of panels) {
        const box = panel.getBoundingClientRect();
        const holds = box.height > height * 1.2;
        // Coming in: 0 as the chapter's top enters the window, 1 once it reaches the top (or, where nothing holds, once the chapter is centred).
        const rest = holds ? 0 : (height - box.height) / 2;
        const e = Math.max(0, Math.min(1, (height * .92 - box.top) / Math.max(1, height * .92 - rest)));
        // Holding: the chapter's one act, done by 85% of the hold so the finished picture rests before the page moves on.
        const h = holds ? Math.max(0, Math.min(1, -box.top / Math.max(1, (box.height - height) * .85))) : Math.max(0, Math.min(1, (e - .35) / .65));
        panel.style.setProperty("--e", (1 - (1 - e) ** 3).toFixed(4));
        panel.style.setProperty("--h", (h * h * (3 - 2 * h)).toFixed(4));
      }
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); };
  }, []);
  return <section ref={root} className="relief-story" aria-label="What a conference does with Kind Helps">
    {story.map((part, index) => <article key={part.picture} className="relief-panel" data-side={index % 2 ? "left" : "right"}>
      <div className="relief-hold">
      <div className="relief-words"><h2>{part.title}</h2><p>{part.copy}</p></div>
      <div className="relief-picture" data-picture={part.picture}>
        <div className="relief-layers">
          {part.pieces.length ? <picture>
            <source type="image/avif" srcSet={layer(`${part.picture}-plate`, 768, 1536, "avif")} sizes={sizes} />
            <img src={`/assets/home/relief-${part.picture}-plate-1536.webp`} srcSet={layer(`${part.picture}-plate`, 768, 1536, "webp")} sizes={sizes} width={1536} height={1024} alt="" loading="lazy" decoding="async" />
          </picture>
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={`/assets/home/relief-${part.picture}-1536.webp`} srcSet={layer(part.picture, 768, 1536, "webp")} sizes={sizes} width={1536} height={1024} alt="" loading="lazy" decoding="async" />}
          {part.pieces.map((piece, order) => <div key={piece} className="relief-piece" data-moves={order === 0 || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="relief-shadow" src={`/assets/home/relief-${part.picture}-${piece}-shadow.webp`} width={400} height={272} alt="" loading="lazy" decoding="async" />
            <picture>
              <source type="image/avif" srcSet={layer(`${part.picture}-${piece}`, 800, 1600, "avif")} sizes={sizes} />
              <img src={`/assets/home/relief-${part.picture}-${piece}-1600.webp`} srcSet={layer(`${part.picture}-${piece}`, 800, 1600, "webp")} sizes={sizes} width={1600} height={1088} alt="" loading="lazy" decoding="async" />
            </picture>
          </div>)}
        </div>
      </div>
      </div>
    </article>)}
  </section>;
}
