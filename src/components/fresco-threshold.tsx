"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
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
// Through the doors: the courtyard grows from the opening until it fills the window, holds a beat, then draws back into its frame on the wall.
const walkThrough = [1.85, 2.45] as const;
const standing = [2.45, 3.05] as const;
const wallOpens = [3.05, 3.75] as const;
// The walk in, when the doors are opened by their button: long enough to read as steps, not a jump.
const walkTime = 1400;
// The longest the walk waits for the courtyard to be ready after the press.
const readyWait = 700;
// How much larger than its frame the painting is drawn on a wide wall.
const frescoInset = 1.064;
// Where the bell tower ends, as a share of the painting's width from its left edge, with a little air.
const towerClear = .4;

/** The doors open once, onto the courtyard painted on the wall beyond them. */
// The courtyard's light is drawn with the 3D library, which is fetched only when the doors are near, not with the page.
const LivingCourtyard = dynamic(() => import("./living-courtyard").then(module => module.LivingCourtyard), { ssr: false });

export function FrescoThreshold() {
  const journey = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const walking = useRef(false);
  const [near, setNear] = useState(false);
  const settled = useSettled();
  // A wide window counts as near as soon as the page is quiet; settled is only ever true in the browser, so the server's drawing is unchanged.
  const living = near || (settled && matchMedia("(min-width: 1200px)").matches);

  // The courtyard is fetched and drawn before anyone can walk into it: when the doors come near, or a pointer or the keyboard reaches their button.
  const warm = () => {
    setNear(true);
    void stage.current?.querySelector<HTMLImageElement>(".fresco-painting")?.decode().catch(() => undefined);
  };
  useEffect(() => {
    const host = stage.current;
    if (!host || !("IntersectionObserver" in window)) return;
    // On a phone the courtyard's living layers are a megabyte and a half: they wait for the visitor to set out down the page, below.
    if (matchMedia("(max-width: 700px)").matches) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: "100% 0px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // A wide window prepares the courtyard while the opening is being read: once the page is quiet its painting is decoded
    // and its living layers are drawn once out of sight, so the first walk in never meets a picture still arriving.
    if (!settled || !matchMedia("(min-width: 1200px)").matches) return;
    void stage.current?.querySelector<HTMLImageElement>(".fresco-painting")?.decode().catch(() => undefined);
  }, [settled]);
  useEffect(() => {
    // The living courtyard waits for the first sign that the visitor is on their way to it.
    // A wide window warms it after a moment of quiet, or at the first scroll. A phone waits until the visitor is half a screen down the page.
    const phone = matchMedia("(max-width: 700px)").matches;
    const arrive = () => { if (!phone || scrollY > innerHeight / 2) { setNear(true); window.removeEventListener("scroll", arrive); } };
    const timer = phone ? 0 : window.setTimeout(arrive, 6000);
    window.addEventListener("scroll", arrive, { passive: true });
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
      // With Reduce Motion there is no walk: the doors open onto the framed courtyard.
      const through = media.matches ? 0 : ease(clamp((travelled - walkThrough[0]) / (walkThrough[1] - walkThrough[0])));
      const grow = media.matches ? door : ease(clamp((travelled - wallOpens[0]) / (wallOpens[1] - wallOpens[0])));
      const inside = through * (1 - grow);
      const standingIn = media.matches ? 0 : clamp((travelled - standing[0]) / (standing[1] - standing[0])) * (1 - grow);
      // The doorway, as painted; and the fresco's frame on the wall beyond it.
      const doorWidth = phone ? width * .73 : Math.min(width * .5, 630);
      const narrowShort = height <= 500 && width > height && width <= 600;
      // Short and narrow, the doors stand whole in the window below the header bar.
      const doorHeight = narrowShort ? Math.min(height - 72, doorWidth * 1.35) : Math.min(height * (phone ? .5 : .78), doorWidth * (phone ? 1.6 : 1.35));
      // A window both short and narrow (a small window at 400% zoom) has no room for the words beside the doors: the words stand
      // alone first, across the paper, and the doors come up from below the window as the visitor goes on, taking the words' place.
      const tiny = narrowShort;
      const rise = tiny ? ease(clamp((travelled - .35) / (doorsOpen[0] - .35))) : 1;
      const doorX = phone || tiny ? width / 2 : width / 2 + doorWidth * .2, doorY = phone ? height * .54 : tiny ? mix(height + doorHeight / 2 + 24, 60 + (height - 60) / 2, rise) : height * .52;
      host.dataset.tiny = String(tiny);
      host.dataset.rising = String(tiny && rise > 0);
      const frameHeight = phone ? Math.min((width - 40) * 1.2, height - 290) : short ? height - 124 : Math.min(width * .35, height - 290);
      const frameWidth = phone ? width - 40 : frameHeight * 2;
      const frameY = (short ? 60 : Math.max(phone ? 84 : 96, (height - frameHeight - (phone ? 150 : 120)) / 2)) + frameHeight / 2;
      const corner = Math.min(frameWidth * .18, frameHeight * .36);
      // The opening travels door, then past the window, then frame. Walking in, the arch keeps its curve and grows until its shoulders have left the window: a box half as wide again as the window, a little above it, clears the top corners.
      const pastW = width * 1.5, pastH = height * 1.6, pastTop = -height * .13;
      const w = mix(mix(doorWidth, frameWidth, grow), pastW, inside), h = mix(mix(doorHeight, frameHeight, grow), pastH, inside);
      const centreY = mix(mix(doorY, frameY, grow), pastTop + pastH / 2, inside);
      wall.style.width = `${w}px`; wall.style.height = `${h}px`;
      // Moved by translate only, from a box held at the stage's corner: its size changes, but nothing in the page's layout moves as it travels.
      wall.style.translate = `${(mix(mix(doorX, width / 2, grow), width / 2, inside) - w / 2).toFixed(2)}px ${(centreY - h / 2).toFixed(2)}px`;
      // Once the opening is past every edge of the window its arch is out of sight: the wall drops its rounded clip, so the courtyard is no longer drawn twice through a mask on every frame of the walk.
      const covers = centreY - h / 2 <= 0 && centreY + h / 2 >= height && w >= width;
      wall.style.borderRadius = covers ? "0" : `${mix(50, corner / frameWidth * 100, grow)}% ${mix(50, corner / frameWidth * 100, grow)}% 0 0 / ${mix(30, corner / frameHeight * 100, grow)}% ${mix(30, corner / frameHeight * 100, grow)}% 0 0`;
      // The painting keeps one size and is only ever scaled, so the living scene is never redrawn at a new size mid-journey.
      const sceneHeight = Math.max(doorHeight, frameHeight, media.matches ? 0 : height);
      scene.style.width = `${sceneHeight * 2}px`; scene.style.height = `${sceneHeight}px`;
      // On a wide wall the near pillar at the painting's left edge is left outside the frame: the painting is drawn a little larger and held to the right, so painted courtyard meets the frame on every side.
      // The painting is sized by the opening, except walking in, where it covers the window itself while the opening grows past it.
      const framed = Math.max(h / sceneHeight, w / (sceneHeight * 2)) * (phone ? 1 : frescoInset);
      const cover = mix(framed, Math.max(height / sceneHeight, width / (sceneHeight * 2)), inside);
      const held = phone ? 0 : sceneHeight * cover * (1 - 1 / frescoInset) * (1 - inside);
      const lift = (height / 2 - centreY) * inside;
      // On a phone, walking in, the narrow window would cut the bell tower at its left edge: the painting is drawn on a little, so that edge always falls clear to the right of the tower.
      const paintingWidth = sceneHeight * 2 * cover, seenLeft = Math.max(0, width / 2 - w / 2);
      const leftEdge = (seenLeft - (width / 2 - paintingWidth / 2)) / paintingWidth;
      const pan = phone ? Math.max(0, towerClear - leftEdge) * paintingWidth * Math.min(1, inside * 4) : 0;
      scene.style.scale = String(cover);
      // The painting is centred in the opening by translate too, from the opening's corner.
      scene.style.translate = `calc(-50% + ${(w / 2 - held - pan).toFixed(2)}px) calc(-50% + ${(h / 2 + lift).toFixed(2)}px)`;
      host.style.setProperty("--door", door.toFixed(4));
      // Once the doors begin to open the words stay out, even while their button still holds the keyboard.
      host.dataset.opening = String(door > 0);
      host.style.setProperty("--grow", grow.toFixed(4));
      // How far inside the courtyard the visitor stands: the frame, the doors and the wall are gone at 1.
      host.style.setProperty("--inside", inside.toFixed(4));
      host.style.setProperty("--standing", standingIn.toFixed(4));
      // The doors' headline is drawn up out of two cuts in the wall's paper, a line at a time, as the opening is lifted off the wall; with Reduce Motion it is simply there.
      const come = media.matches ? 1 : clamp((travelled - .35) / .5);
      host.style.setProperty("--come", come.toFixed(4));
      host.dataset.slipping = String(come > 0 && come < 1);
      // Standing in the courtyard, the words are a strip of paper laid on the paving that stands up as the walk ends, and lies back down as the courtyard draws back into its frame.
      host.style.setProperty("--stand", ease(clamp((inside - .55) / .45)).toFixed(4));
      host.dataset.inside = String(inside > .98);
      // The courtyard is all painting: the bar drawn over it leaves in one cut as the visitor steps in and returns in one as they step out.
      host.dataset.within = String(inside > 0);
      // Once the visitor has walked in, the wall they came through is behind them: its words do not come back with the frame.
      host.dataset.walked = String(inside > .98 || grow > 0);
      host.style.setProperty("--door-progress", (door * .05).toFixed(4));
      host.style.setProperty("--caption-top", `${frameY + frameHeight / 2}px`);
      setOpen(grow > .5 || inside > .5);
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    const observer = new ResizeObserver(request);
    observer.observe(host);
    window.addEventListener("scroll", request, { passive: true });
    media.addEventListener("change", request);
    update();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("scroll", request); media.removeEventListener("change", request); };
  }, []);
  // Through the doors, the keyboard and a screen reader are set down on the courtyard's own line, told where they now stand,
  // and not left on a button that is gone.
  const entering = useRef(false), caption = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!open || !entering.current) return;
    entering.current = false;
    caption.current?.focus({ preventScroll: true });
  }, [open]);
  const walkIn = () => {
    const track = journey.current, host = stage.current;
    if (!track || !host) return;
    entering.current = true;
    // With Reduce Motion the journey is shorter, so the resting place stays inside the part that holds still.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = track.getBoundingClientRect().top + scrollY;
    if (reduce) { window.scrollTo({ top: start + host.clientHeight * 2.4, behavior: "instant" }); return; }
    // The doors open and the visitor walks through in one paced move, coming to a stop standing in the courtyard.
    // A second press while walking changes nothing: the walk already under way carries on.
    if (walking.current) return;
    walking.current = true;
    // The walk starts once the courtyard is drawn and its painting decoded, so no picture arrives mid-walk; it never waits longer than a short beat.
    warm();
    const asked = performance.now();
    const ready = () => {
      const painting = host.querySelector<HTMLImageElement>(".fresco-painting");
      return host.dataset.living === "true" && !!painting?.complete;
    };
    const go = () => {
      if (!ready() && performance.now() - asked < readyWait) return void requestAnimationFrame(go);
      walk();
    };
    const walk = () => {
    const from = scrollY, to = start + host.clientHeight * (standing[0] + .05);
    const began = performance.now();
    // Paced by the clock, not by frames: a frame the browser holds back (a window behind another) is made up at the next step, and a timer carries the walk if frames stop coming.
    let timer = 0, frame = 0;
    const step = () => {
      cancelAnimationFrame(frame); clearTimeout(timer);
      const t = Math.max(0, Math.min(1, (performance.now() - began) / walkTime));
      window.scrollTo({ top: from + (to - from) * (1 - Math.pow(1 - t, 3)), behavior: "instant" });
      if (t >= 1) { walking.current = false; return; }
      frame = requestAnimationFrame(step);
      timer = window.setTimeout(step, 50);
    };
    step();
    };
    go();
  };

  return <div ref={journey} className="fresco-journey">
    <section ref={stage} className="fresco-stage" id="your-community" tabIndex={-1} aria-label="The doors and the courtyard" data-open={open} data-settled={settled} data-destination="1">
      {/* The same name and way in as the opening's bar, drawn again over the courtyard for the eye; a keyboard or a screen reader meets them once, above. */}
      <header className="fresco-header" aria-hidden="true">
        <a href="#story-start" className="fresco-brand" tabIndex={-1}>kind helps</a>
        <Link href="/app" tabIndex={-1}>Enter Kind Helps<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="fresco-invitation" aria-hidden={open}>
        {/* Joe's line between the opening and the doors, set as the lead-in to the doors' one headline. */}
        <p className="fresco-kicker">Small acts. Shared purpose.</p>
        <h2><span className="fresco-slot" style={{ "--line": 0 } as CSSProperties}><span>There is room</span></span><span className="fresco-slot" style={{ "--line": 1 } as CSSProperties}><span><em>for you.</em></span></span></h2>
        <p>Bring a little of your time.</p>
        <Button className="fresco-open" onClick={walkIn} onPointerEnter={warm} onFocus={warm} tabIndex={open ? -1 : undefined}>Open the doors<ArrowRight size={18} aria-hidden="true" /></Button>
      </div>
      <div ref={frame} className="fresco-frame">
        <div className="fresco-wall">
          <div ref={view} className="fresco-view">
            {/* The courtyard is one painting, seen once. A native image keeps it whole without the living layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {settled && <img className="fresco-painting" src="/assets/threshold/courtyard-fresco.webp" width="1774" height="887" decoding="async" alt="A sunlit church courtyard painted on the wall: a woman prepares food at a long shared table, under arches hung with wisteria." />}
            {living && settled && <LivingCourtyard within=".fresco-stage" painting=".fresco-painting" />}
          </div>
        </div>
        <div className="fresco-doors" aria-hidden="true"><i /><i /></div>
      </div>
      <p className="fresco-standing" aria-hidden="true">Faith, <em>lived out.</em></p>
      <p className="fresco-caption" aria-hidden={!open} ref={caption} tabIndex={-1}>Faith, <em>lived out.</em></p>
    </section>
  </div>;
}
