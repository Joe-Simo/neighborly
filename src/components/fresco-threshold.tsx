"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { useSettled } from "@/lib/use-settled";
import "./relief-journey.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
// Screens of scrolling, counted from where the opening begins to give way: the doors rest, open, and the wall opens around the fresco.
const doorsOpen = [1.15, 1.85] as const;
// The wall waits until the doors have swung clear, so the two never show at once.
const wallOpens = [1.9, 2.7] as const;
const rest = 2.9;
// How much larger than its frame the painting is drawn on a wide wall.
const frescoInset = 1.064;

/** The doors open once, onto the courtyard painted on the wall beyond them. */
// The courtyard's light is drawn with the 3D library, which is fetched only when the doors are near, not with the page.
const LivingCourtyard = dynamic(() => import("./living-courtyard").then(module => module.LivingCourtyard), { ssr: false });

export function FrescoThreshold() {
  const journey = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [near, setNear] = useState(false);
  const settled = useSettled();

  useEffect(() => {
    // The living courtyard waits for the first sign that the visitor is on their way to it.
    const arrive = () => setNear(true);
    const timer = setTimeout(arrive, 6000);
    window.addEventListener("scroll", arrive, { once: true, passive: true });
    return () => { clearTimeout(timer); window.removeEventListener("scroll", arrive); };
  }, []);
  useEffect(() => {
    const track = journey.current, host = stage.current, wall = frame.current, scene = view.current;
    if (!track || !host || !wall || !scene) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const update = () => {
      raf = 0;
      const width = host.clientWidth, height = host.clientHeight;
      // A phone on its side is wide but short: it takes the wide layout with a lower fresco.
      const short = height <= 500 && width > height;
      const phone = width <= 899 && !short;
      const travelled = -track.getBoundingClientRect().top / Math.max(1, height);
      const door = media.matches ? Number(travelled > 1.5) : ease(clamp((travelled - doorsOpen[0]) / (doorsOpen[1] - doorsOpen[0])));
      const grow = media.matches ? door : ease(clamp((travelled - wallOpens[0]) / (wallOpens[1] - wallOpens[0])));
      // The doorway, as painted; and the fresco's frame on the wall beyond it.
      const doorWidth = phone ? width * .73 : Math.min(width * .5, 630);
      const doorHeight = Math.min(height * (phone ? .5 : .78), doorWidth * (phone ? 1.6 : 1.35));
      const doorX = phone ? width / 2 : width / 2 + doorWidth * .2, doorY = phone ? height * .54 : height * .52;
      const frameHeight = phone ? Math.min((width - 40) * 1.2, height - 290) : short ? height - 124 : Math.min(width * .35, height - 290);
      const frameWidth = phone ? width - 40 : frameHeight * 2;
      const frameY = (short ? 60 : Math.max(phone ? 84 : 96, (height - frameHeight - (phone ? 150 : 120)) / 2)) + frameHeight / 2;
      const corner = Math.min(frameWidth * .18, frameHeight * .36);
      const w = mix(doorWidth, frameWidth, grow), h = mix(doorHeight, frameHeight, grow);
      wall.style.width = `${w}px`; wall.style.height = `${h}px`;
      wall.style.left = `${mix(doorX, width / 2, grow) - w / 2}px`; wall.style.top = `${mix(doorY, frameY, grow) - h / 2}px`;
      wall.style.borderRadius = `${mix(50, corner / frameWidth * 100, grow)}% ${mix(50, corner / frameWidth * 100, grow)}% 0 0 / ${mix(30, corner / frameHeight * 100, grow)}% ${mix(30, corner / frameHeight * 100, grow)}% 0 0`;
      // The painting keeps one size and is only ever scaled, so the living scene is never redrawn at a new size mid-journey.
      const sceneHeight = Math.max(doorHeight, frameHeight);
      scene.style.width = `${sceneHeight * 2}px`; scene.style.height = `${sceneHeight}px`;
      // On a wide wall the near pillar at the painting's left edge is left outside the frame: the painting is drawn a little larger and held to the right, so painted courtyard meets the frame on every side.
      const cover = Math.max(h / sceneHeight, w / (sceneHeight * 2)) * (phone ? 1 : frescoInset);
      scene.style.scale = String(cover);
      scene.style.translate = phone ? "" : `calc(-50% - ${(sceneHeight * cover * (1 - 1 / frescoInset)).toFixed(2)}px) -50%`;
      host.style.setProperty("--door", door.toFixed(4));
      // Once the doors begin to open the words stay out, even while their button still holds the keyboard.
      host.dataset.opening = String(door > 0);
      host.style.setProperty("--grow", grow.toFixed(4));
      host.style.setProperty("--door-progress", (door * .05).toFixed(4));
      host.style.setProperty("--caption-top", `${frameY + frameHeight / 2}px`);
      setOpen(grow > .5);
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    const observer = new ResizeObserver(request);
    observer.observe(host);
    window.addEventListener("scroll", request, { passive: true });
    media.addEventListener("change", request);
    update();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("scroll", request); media.removeEventListener("change", request); };
  }, []);
  const walkIn = () => {
    const track = journey.current, host = stage.current;
    if (!track || !host) return;
    // With Reduce Motion the journey is shorter, so the resting place stays inside the part that holds still.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: track.getBoundingClientRect().top + scrollY + host.clientHeight * (reduce ? 2.4 : rest), behavior: reduce ? "instant" : "smooth" });
  };

  return <div ref={journey} className="fresco-journey">
    <section ref={stage} className="fresco-stage" id="your-community" tabIndex={-1} aria-label="The doors and the courtyard" data-open={open} data-settled={settled} data-destination="1">
      <header className="fresco-header">
        <a href="#story-start" className="fresco-brand" aria-label="Kind Helps home">kind helps</a>
        <Link href="/app">Enter Kind Helps<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="fresco-invitation" aria-hidden={open}>
        <h2>There is room<br /><em>for you.</em></h2>
        <p>Bring a little of your time.<br />See what we can make together.</p>
        <Button className="fresco-open" onClick={walkIn} tabIndex={open ? -1 : undefined}>Open the doors<ArrowRight size={18} aria-hidden="true" /></Button>
      </div>
      <div ref={frame} className="fresco-frame">
        <div className="fresco-wall">
          <div ref={view} className="fresco-view">
            {/* The courtyard is one painting, seen once. A native image keeps it whole without the living layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {settled && <img className="fresco-painting" src="/assets/threshold/courtyard-fresco.webp" width="1774" height="887" decoding="async" alt="A sunlit church courtyard painted on the wall: a woman prepares food at a long shared table, under arches hung with wisteria." />}
            {near && settled && <LivingCourtyard within=".fresco-stage" painting=".fresco-painting" />}
          </div>
        </div>
        <div className="fresco-doors" aria-hidden="true"><i /><i /></div>
      </div>
      <p className="fresco-caption" aria-hidden={!open}>Faith, <em>lived out.</em></p>
    </section>
  </div>;
}
