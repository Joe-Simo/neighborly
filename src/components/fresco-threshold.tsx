"use client";

import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { CourtyardAssembly } from "./courtyard-assembly";
import { CourtyardDoor, goInTurning } from "./courtyard-door";
import { useRouter } from "next/navigation";
import { useSettled } from "@/lib/use-settled";
import { frameStep } from "@/lib/scroll-frame";
import "./relief-journey.css";
import { CutHead } from "@/components/cut-heads";

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
// Standing in the courtyard on a phone, the window is narrow and tall: it is drawn on to the hall's arch and its open door (as shares of the
// painting from its top left), a little closer, so the frame holds the arch, the door and the table's end, not the empty paving.
const phoneFocus = { x: .78, y: .4, zoom: 1.24 } as const;

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
  const router = useRouter();
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
    // Read in the shared frame's first half, before any part of the page has written (scroll-frame.ts).
    let width = 0, height = 0, trackTop = 0;
    const read = () => { width = host.clientWidth; height = host.clientHeight; trackTop = track.getBoundingClientRect().top; };
    let placed: { size: string; top: number } | undefined;
    // Where the invitation's words end, measured once for each size of window (they never move within one), never on the frames of the walk.
    let words: { size: string; foot: number } | undefined;
    // The parts drawn with each of the walk's values (relief-journey.css). The stage keeps its own copy of the values scripts read from it; those values are registered not to pass down (relief-journey.css).
    const all = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)];
    const drawnBy: Record<string, HTMLElement[]> = { "--door": all(".fresco-doors i"), "--grow": [wall, ...all(".fresco-doors, .fresco-ring")], "--inside": all(".fresco-doors i, .fresco-ring, .fresco-face"), "--come": all(".fresco-slot>span, .fresco-slip"), "--stand": all(".fresco-standing") };
    const put = (name: string, value: string) => { if (name !== "--stand") host.style.setProperty(name, value); for (const part of drawnBy[name] ?? []) part.style.setProperty(name, value); };
    const update = () => {
      // A phone on its side is wide but short: it takes the wide layout with a lower fresco.
      const short = height <= 500 && width > height;
      const phone = width <= 899 && !short;
      const travelled = -trackTop / Math.max(1, height);
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
      const cover = mix(framed, Math.max(height / sceneHeight, width / (sceneHeight * 2)) * (phone ? phoneFocus.zoom : 1), inside);
      const held = phone ? 0 : sceneHeight * cover * (1 - 1 / frescoInset) * (1 - inside);
      // On a phone, walking in, the painting is drawn on to its focus: across to the arch and up from the paving, never past its own edges.
      const paintingWidth = sceneHeight * 2 * cover, paintingHeight = sceneHeight * cover;
      const toward = phone ? Math.min(1, inside * 1.6) : 0;
      const pan = Math.max(0, Math.min((phoneFocus.x - .5) * paintingWidth, paintingWidth / 2 - width / 2)) * toward;
      const raise = Math.max(0, Math.min((.5 - phoneFocus.y) * paintingHeight, paintingHeight / 2 - height / 2)) * toward;
      const lift = (height / 2 - centreY) * inside + raise;
      scene.style.scale = String(cover);
      // The painting is centred in the opening by translate too, from the opening's corner.
      scene.style.translate = `calc(-50% + ${(w / 2 - held - pan).toFixed(2)}px) calc(-50% + ${(h / 2 + lift).toFixed(2)}px)`;
      put("--door", door.toFixed(4));
      // Once the doors begin to open the words stay out, even while their button still holds the keyboard.
      host.dataset.opening = String(door > 0);
      put("--grow", grow.toFixed(4));
      // How far inside the courtyard the visitor stands: the frame, the doors and the wall are gone at 1.
      put("--inside", inside.toFixed(4));
      host.style.setProperty("--standing", standingIn.toFixed(4));
      // The doors' headline is drawn up out of two cuts in the wall's paper, a line at a time, as the opening is lifted off the wall; with Reduce Motion it is simply there.
      // On a narrow window the headline sits under the opening's sheet until it has cleared, so its cut comes later, ending as the doors begin to open.
      const come = media.matches ? 1 : phone ? clamp((travelled - .72) / .25) : clamp((travelled - .35) / .5);
      put("--come", come.toFixed(4));
      // A line part way through its cut keeps the cut's edge and shade beside it, so no letter is ever seen without the paper it comes from.
      [0, 1].forEach(line => { const through = clamp((come - line * .3) / .7); host.dataset[`slip${line}`] = String(through > 0 && through < 1); });
      // Standing in the courtyard, the words are a strip of paper laid on the paving that stands up as the walk ends, and lies back down as the courtyard draws back into its frame.
      // It is never seen more than 60° off upright: hidden until the walk is past halfway, then stood up from 60°.
      put("--stand", ease(clamp((inside - .55) / .45)).toFixed(4));
      host.dataset.standing = String(inside > .55);
      host.dataset.stood = String(inside >= 1);
      host.dataset.inside = String(inside > .98);
      // The courtyard is all painting: the bar drawn over it leaves in one cut as the visitor steps in and returns in one as they step out.
      host.dataset.within = String(inside > 0);
      // Once the visitor has walked in, the wall they came through is behind them: its words do not come back with the frame.
      // On a phone the arch grows up over the words as the visitor walks in: they leave in one cut the moment its top would reach them,
      // so no line of them is ever seen half under it.
      const windowSize = `${width}x${height}`;
      if (words?.size !== windowSize) words = { size: windowSize, foot: host.querySelector(".fresco-invitation h2")?.getBoundingClientRect().bottom ?? 0 };
      host.dataset.walked = String(inside > .98 || grow > 0 || (inside > 0 && centreY - h / 2 < words.foot + 8));
      host.style.setProperty("--door-progress", (door * .05).toFixed(4));
      // Under the frame as it is actually drawn (its ring and any scale included): each time the courtyard rests in its frame, the line's own box is
      // measured against the frame's drawn bottom and set at least 12px clear of it, so no letter is ever under its edge.
      // It is measured once each time the frame comes to rest at a new size, never on the frames after, so scrolling on past costs no layout.
      let captionTop = frameY + frameHeight / 2;
      const line = host.querySelector<HTMLElement>(".fresco-caption");
      const rested = grow > .999 && inside < .001 && !!line;
      const size = `${width}x${height}`;
      if (rested && placed?.size !== size) {
        line.style.setProperty("--caption-top", `${captionTop}px`);
        const gap = line.getBoundingClientRect().top - wall.getBoundingClientRect().bottom;
        placed = { size, top: captionTop + Math.max(0, 12 - gap) };
      }
      if (!rested) placed = undefined;
      if (placed) captionTop = placed.top;
      // Written on the line alone, and only when it has moved: it is the only part drawn with it, and it is placed by translate, so no frame lays out the stage.
      const top = `${captionTop.toFixed(1)}px`;
      if (line && line.style.getPropertyValue("--caption-top") !== top) line.style.setProperty("--caption-top", top);
      // Clear or hidden, never half under the frame: the line is shown only once the frame has rested and it has been placed, in place, with no fade.
      host.dataset.captioned = String(rested);
      setOpen(grow > .5 || inside > .5);
    };
    const { ask: request, drop } = frameStep(read, update);
    const observer = new ResizeObserver(request);
    observer.observe(host);
    window.addEventListener("scroll", request, { passive: true });
    media.addEventListener("change", request);
    read();
    update();
    return () => { drop(); observer.disconnect(); window.removeEventListener("scroll", request); media.removeEventListener("change", request); };
  }, []);
  // Through the doors, the keyboard and a screen reader are set down on the courtyard's own line, told where they now stand,
  // and not left on a button that is gone.
  const entering = useRef<"key" | "pointer" | false>(false), caption = useRef<HTMLParagraphElement>(null);
  // Once the courtyard opens, the way in is fetched ahead, so no cold frame can land inside the turn.
  useEffect(() => { if (open) router.prefetch("/app"); }, [open, router]);
  useEffect(() => {
    if (!open || entering.current !== "pointer") return;
    entering.current = false;
    caption.current?.focus({ preventScroll: true });
  }, [open]);
  // Pressed from the keyboard, the doors' button goes once they open; when the walk has come to rest, focus is handed to the courtyard's way in, so it never falls to the page.
  const arrive = (tries = 30) => {
    if (entering.current !== "key") return;
    const door = stage.current?.querySelector<HTMLElement>(".fresco-door");
    // The doors count as open a frame or two after the scroll that opens them.
    if (!(door && door.tabIndex >= 0) && tries > 0) return void requestAnimationFrame(() => arrive(tries - 1));
    entering.current = false;
    (door && door.tabIndex >= 0 ? door : caption.current)?.focus({ preventScroll: true });
  };
  const walkIn = (event: MouseEvent<HTMLButtonElement>) => {
    const track = journey.current, host = stage.current;
    if (!track || !host) return;
    // A press from the keyboard comes as a click with no count; only then is focus carried to the courtyard when the walk rests.
    const byKey = event.detail === 0;
    entering.current = byKey ? "key" : "pointer";
    // With Reduce Motion the journey is shorter, so the resting place stays inside the part that holds still.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = track.getBoundingClientRect().top + scrollY;
    if (reduce) { window.scrollTo({ top: start + host.clientHeight * 2.4, behavior: "instant" }); if (byKey) requestAnimationFrame(() => arrive()); return; }
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
      if (t >= 1) { walking.current = false; if (byKey) requestAnimationFrame(() => arrive()); return; }
      frame = requestAnimationFrame(step);
      timer = window.setTimeout(step, 50);
    };
    step();
    };
    go();
  };

  return <div ref={journey} className="fresco-journey">
    <section ref={stage} className="fresco-stage" id="your-community" tabIndex={-1} aria-label="The doors and the courtyard" data-open={open} data-settled={settled} data-destination="1">
      {/* The same name and way in as the opening's bar, drawn again over the doors for the eye; a keyboard or a screen reader meets them once, above. Pressed, it goes in as the arch does: the stage is held and turned off the workspace. */}
      <header className="fresco-header" aria-hidden="true">
        <a href="#story-start" className="fresco-brand" tabIndex={-1}>kind helps</a>
        <Link href="/app" tabIndex={-1} onClick={event => goInTurning(event, router.push, "Opening…")} onPointerEnter={() => router.prefetch("/app")}>Enter Kind Helps<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="fresco-invitation" aria-hidden={open}>
        {/* Joe's line between the opening and the doors, set as the lead-in to the doors' one headline. */}
        <p className="fresco-kicker">One call. Two at the door.</p>
        <CutHead><span className="fresco-slot" style={{ "--line": 0 } as CSSProperties}><span>There is room</span><i className="fresco-slip" /></span><span className="fresco-slot" style={{ "--line": 1 } as CSSProperties}><span><em>for you.</em></span><i className="fresco-slip" /></span></CutHead>
        <p>Bring a little of your time.</p>
        <Button className="fresco-open" onClick={walkIn} onPointerEnter={warm} onFocus={warm} tabIndex={open ? -1 : undefined}>Open the doors<ArrowRight size={18} aria-hidden="true" /></Button>
      </div>
      <div ref={frame} className="fresco-frame">
        <i className="fresco-ring" aria-hidden="true" />
        <div className="fresco-wall">
          <div ref={view} className="fresco-view">
            {/* The courtyard is one painting, seen once. A native image keeps it whole without the living layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {settled && <img className="fresco-painting" src="/assets/threshold/courtyard-fresco.webp" width="1774" height="887" decoding="async" alt="A sunlit church courtyard painted on the wall: a woman prepares food at a long shared table, under arches hung with wisteria." />}
            {living && settled && <LivingCourtyard within=".fresco-stage" painting=".fresco-painting" />}
            {settled && <CourtyardAssembly />}
            {/* The hall's open arch in the painting is the way into Kind Helps, turned to like a page. */}
            <CourtyardDoor label="Enter Kind Helps" opening="Opening…" here={open} />
          </div>
          <i className="fresco-face" aria-hidden="true" />
        </div>
        <div className="fresco-doors" aria-hidden="true"><i /><i /></div>
      </div>
      <p className="fresco-standing" aria-hidden="true"><span>Faith, <em>lived out.</em></span></p>
      <p className="fresco-caption" aria-hidden={!open} ref={caption} tabIndex={-1}>Faith, <em>lived out.</em></p>
    </section>
  </div>;
}
