"use client";

import Image from "next/image";
import Link from "next/link";
import { useExperienceSound } from "./experience-sound-context";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import "./hall-transition-study.css";
import { getHallTransitionFraming, getEmbeddedHallTransitionFraming } from "@/lib/hall-transition-framing";

export function HallTransitionStudy({ embedded = false, onReplay }: { embedded?: boolean; onReplay?: () => void }) {
  const sound = useExperienceSound();
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLElement>(null);
  const interiorReady = useRef(false);
  const refresh = useRef<(() => void) | null>(null);
  const [interiorFailed, setInteriorFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [nearby, setNearby] = useState(!embedded);
  useEffect(() => {
    if (!embedded || !track.current) return;
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setNearby(true)); return () => cancelAnimationFrame(frame); }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: "100% 0px" });
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [embedded]);
  useEffect(() => {
    const element = track.current;
    const viewport = stage.current;
    if (!element || !viewport) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastSound: "welcome" | "complete" | null = null;
    const update = () => {
      if (frame || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const bounds = element.getBoundingClientRect();
        const stageHeight = viewport.getBoundingClientRect().height;
        const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - stageHeight)));
        const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
        const approach = ease((progress - .08) / .56);
        const dissolve = Number(progress >= .66 && interiorReady.current);
        const framing = embedded ? getEmbeddedHallTransitionFraming(viewport.clientWidth, stageHeight, approach, media.matches) : getHallTransitionFraming(viewport.clientWidth, stageHeight, 2, approach, media.matches);
        viewport.style.setProperty("--hall-image-width", `${framing.imageWidth}px`);
        viewport.style.setProperty("--hall-image-height", `${framing.imageHeight}px`);
        viewport.style.setProperty("--hall-origin-x", `${framing.originX}px`);
        viewport.style.setProperty("--hall-origin-y", `${framing.originY}px`);
        viewport.style.setProperty("--hall-scale", String(framing.scale));
        viewport.style.setProperty("--hall-x", `${framing.translateX}px`);
        viewport.style.setProperty("--hall-mix", String(dissolve));
        viewport.style.setProperty("--hall-arrival-scale", String(media.matches ? 1 : 1 + ease((progress - .76) / .24) * .04));
        viewport.dataset.arrived = String(dissolve > .5);
        if (result.current) result.current.inert = dissolve < 1;
        if (embedded && bounds.top <= 0 && bounds.bottom > 0) {
          const nextSound = dissolve > .5 ? "complete" : "welcome";
          if (nextSound !== lastSound) { lastSound = nextSound; soundRef.current?.setScene(nextSound); }
        } else lastSound = null;
      });
    };
    refresh.current = update;
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else update(); };
    const observer = new ResizeObserver(update); observer.observe(element); observer.observe(viewport);
    window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    media.addEventListener("change", update); document.addEventListener("visibilitychange", visibility); update();
    return () => { if (refresh.current === update) refresh.current = null; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, [embedded]);
  const Root = embedded ? "div" : "main";
  return <Root className="hall-transition-study" data-embedded={embedded}>
    <section ref={track} id={embedded ? "hall-gathering" : undefined} className="hall-transition-track" aria-label="From the courtyard into the hall">
      <div ref={stage} className="hall-transition-stage">
        {nearby && <><div className="hall-transition-outside">
          <Image src={embedded ? "/assets/threshold/hall-welcome-v1.webp" : "/assets/threshold/courtyard-community-v3.webp"} alt="The painted courtyard, with an open doorway on the right." fill sizes="200vw" unoptimized priority={!embedded} />
          {embedded && <>
            <Image className="hall-transition-chairs" src="/assets/threshold/hall-chairs.webp" alt="" fill sizes="200vw" unoptimized />
            <Image className="hall-transition-flowers" src="/assets/threshold/hall-flowers.webp" alt="" fill sizes="200vw" unoptimized />
          </>}
        </div>
        <Image key={attempt} className="hall-transition-inside" src={`/assets/threshold/hall-interior-v3.webp?v=${attempt}`} onLoad={() => { interiorReady.current = true; setInteriorFailed(false); refresh.current?.(); }} onError={() => { interiorReady.current = false; setInteriorFailed(true); refresh.current?.(); }} alt="Inside the community hall." fill sizes="200vw" unoptimized priority={!embedded} /></>}
        {interiorFailed && <div className="hall-transition-recovery" role="status"><p>The gathering could not load.</p><Button variant="outline" onClick={() => { interiorReady.current = false; setInteriorFailed(false); setAttempt(value => value + 1); refresh.current?.(); }}>Try again</Button><Link href="/app?intent=start">Start a group</Link><Link href="/app?intent=join">Join your people</Link><Link href="/app?intent=signin">Sign in</Link></div>}
        {!embedded && <header><Link href="/depth-candidate">Back to the story</Link><span>Hall transition study</span></header>}
        {embedded && <section ref={result} className="hall-transition-result" aria-labelledby="hall-result-title"><h2 id="hall-result-title">Good work.<br /><em>Together.</em></h2><nav aria-label="Start with Kind Helps"><Link href="/app?intent=start">Start a group</Link><Link href="/app?intent=join">Join your people</Link><Link href="/app?intent=signin">Sign in</Link>{onReplay && <Button variant="ghost" onClick={onReplay}>Replay story</Button>}</nav></section>}
        <p className="hall-transition-cue">Scroll into the hall <span aria-hidden="true">↓</span></p>
      </div>
    </section>
    {!embedded && <footer><h1>A place to gather.</h1><Link href="/depth-candidate">Return to Kind Helps</Link></footer>}
  </Root>;
}
