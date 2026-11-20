"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whenScrollStill } from "@/lib/scroll-still";
import { getPaintedScrollState } from "@/lib/painted-world-scroll";
import { isPaintedPortrait, openingKeptAbove } from "@/lib/painted-world-framing";
import type { PaintedScene, PaintedWorldOptions } from "@/lib/painted-world-controller";
import type { PaintedWorld as World } from "@/lib/painted-world-offscreen";

/** Whether this browser can hand a canvas to a worker at all (the worker learns whether it can draw on it). Kept here, so the
 * worker's module is fetched only when the scene is made, never with the page. */
const canDrawOffPage = () =>
  typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype;
import "./painted-world.css";
import "./cut-edges.css";
import "./public-touch.css";
import { useCutHold } from "./cut-hold";

const chapters = {
  opening: { number: "01", name: "An open hand", title: <>Good things begin<br />with <em>an open hand.</em></>, copy: "A little care can go a long way." },
  meal: { number: "02", name: "A meal shared", title: <>A meal,<br /><em>made together.</em></>, copy: "A meal becomes more when it is shared." },
  visit: { number: "03", name: "A visit made", title: <>A knock.<br /><em>A familiar face.</em></>, copy: "Sit down. Listen to the whole story." },
  welcome: { number: "04", name: "A welcome offered", title: <>A place<br /><em>for everyone.</em></>, copy: "Small acts of care become a community." },
  complete: { number: "04", name: "Good work, together", title: <>Good work,<br /><em>together.</em></>, copy: "Answer the next call for help with your conference." },
} as const;
/** The open hand holding the card, for wide screens: 1440 for one pixel per point, 2880 for two. */
const acceptedStill = "/assets/living-relief-accepted-1440.avif 1440w, /assets/living-relief-accepted-2880.avif 2880w";
function fallbackSource(scene: PaintedScene, mobile: boolean, accepted = false) {
  if (scene === "opening" && accepted) return mobile ? "/assets/living-relief-mobile-accepted.webp" : "/assets/living-relief-accepted.webp";
  if (scene === "opening") return mobile ? "/assets/living-relief-mobile.webp" : "/assets/living-relief-poster.webp";
  return `/assets/painted-world/${scene === "complete" ? "welcome" : scene}${mobile ? "-mobile" : ""}.webp`;
}
/**
 * The home page's 3D opening is built shortly after the painting has shown, once the page is still: its first evaluation and its
 * scene's setup are long tasks, so they wait until the page has been still a quarter second (read from scrollY each frame), then for an idle moment.
 * A visitor who never stops scrolling gets it at the next idle moment eight seconds after the page opened. The still painting carries
 * the opening until then, and the swap is the same single cut as always.
 */
const settleBeforeUpgrade = 250, upgradeAtLatest = 8000;
type Controller = World;
// Where the card rests in the giving hand and in the open hand, as shares of each opening painting.
const cardPath = {
  desktop: { size: [1440, 1024], from: [.443, .749], to: [.722, .772], empty: [880, 646, 360, 295], card: .118 },
  // The phone's still is taken from the scene itself, so one path serves both.
  mobile: { size: [780, 1688], from: [.415, .682], to: [.903, .694], empty: [610, 1071, 170, 165], card: .22 },
} as const;

/** Native scrolling owns the narrative; the artwork never traps wheel or touch input. */
export function PaintedWorld({ scenes, heroOnly = false, passed = false, onPass, onContinue, children }: { scenes?: PaintedWorldOptions["scenes"]; heroOnly?: boolean; passed?: boolean; onPass?: () => void; onContinue?: () => void; children?: ReactNode }) {
  const openingOutcome: "rest" | "accepted" = passed ? "accepted" : "rest";
  const outcomeRef = useRef(openingOutcome);
  useEffect(() => { outcomeRef.current = openingOutcome; controller.current?.setOpeningOutcome(openingOutcome); }, [openingOutcome]);
  const track = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useCutHold(viewport, heroOnly);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const progress = useRef(0);
  const fallbackRef = useRef(false);
  const [scene, setScene] = useState<PaintedScene>("opening");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const visibleScene = heroOnly ? "opening" : scene;
  const chapter = chapters[visibleScene];

  useEffect(() => {
    let disposed = false;
    let active: Controller | undefined;
    let stopStill: (() => void) | undefined;
    const enterFallback = () => {
      if (disposed || fallbackRef.current) return;
      fallbackRef.current = true;
      controller.current = null;
      active?.dispose();
      setFailed(true);
      setLoading(false);
      setScene(heroOnly ? "opening" : getPaintedScrollState(progress.current).captionScene);
    };
    fallbackRef.current = false;
    let nearNow = true;
    // The opening is drawn in a worker where the browser can hand it a canvas, so three.js never holds this page's
    // thread; elsewhere it is drawn here, as before. Either way the still painting stays until its first frame.
    const enhance = () => { void (canDrawOffPage() ? import("@/lib/painted-world-offscreen").then((code) => code.createOffPageWorld) : import("@/lib/painted-world-controller").then((code) => code.createPaintedWorldController)).then((createController) => {
      if (disposed || !host.current || !nearNow) return;
      active = createController(host.current, {
        scenes, mode: "scroll", openingOnly: heroOnly,
        onReady: () => { if (!disposed && !fallbackRef.current) { setReady(true); setFailed(false); active?.setStoryProgress(progress.current); } },
        onSceneChange: (next) => { if (!disposed && !fallbackRef.current) setScene(heroOnly ? "opening" : next); },
        onError: enterFallback,
        onLoadingChange: (value) => { if (!disposed && !fallbackRef.current) setLoading(value); },
      });
      if (fallbackRef.current) active.dispose();
      else { controller.current = active; active.setStoryProgress(progress.current); active.setOpeningOutcome(outcomeRef.current); }
    }).catch(enterFallback); };
    // The responsive painting is the initial experience. Upgrade the optional
    // dimensional guide after critical text and imagery have had time to paint, and while the page is still.
    // Read from scrollY each frame, so a jump by script or Safari's momentum counts as movement too (scroll-still.ts).
    let begun = false, again: (() => void) | undefined;
    const begin = () => { begun = true; enhance(); };
    if (heroOnly) stopStill = whenScrollStill(begin, { settle: settleBeforeUpgrade, latest: upgradeAtLatest });
    else enhance();
    // The opening's scene (its model, textures and graphics context) is let go once the opening is more than two windows behind the reader, and
    // made again as they come back within two: an iPhone counts that memory against the tab. Out of sight, the still painting stands in, as before the upgrade.
    const near = heroOnly && track.current ? new IntersectionObserver(entries => {
      nearNow = entries[entries.length - 1].isIntersecting;
      // Made again only once the page is still: a new context, its shaders and textures held a phone's scroll for a second.
      if (nearNow) { if (begun && !active && !disposed && !fallbackRef.current && !again) again = whenScrollStill(() => { again = undefined; if (nearNow && !active && !disposed && !fallbackRef.current) enhance(); }, { notBefore: 0, latest: Infinity }); return; }
      again?.(); again = undefined;
      if (!active) return;
      active.dispose(); active = undefined; controller.current = null; setReady(false);
    }, { rootMargin: "200% 0px" }) : undefined;
    if (track.current) near?.observe(track.current);
    return () => {
      disposed = true;
      near?.disconnect();
      stopStill?.(); again?.();
      active?.dispose(); controller.current = null;
    };
  }, [scenes, heroOnly]);

  useEffect(() => {
    if (heroOnly) {
      progress.current = 0;
      viewport.current?.style.setProperty("--story-progress", "0");
      controller.current?.setStoryProgress(0);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!track.current || !viewport.current) return;
      const bounds = track.current.getBoundingClientRect();
      const distance = Math.max(1, bounds.height - viewport.current.getBoundingClientRect().height);
      const next = Math.max(0, Math.min(1, -bounds.top / distance));
      progress.current = next;
      viewport.current.style.setProperty("--story-progress", String(next));
      controller.current?.setStoryProgress(next);
      if (fallbackRef.current) setScene(getPaintedScrollState(next).captionScene);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(request);
    if (track.current) observer.observe(track.current);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); };
  }, [heroOnly]);

  // Passing the card: the visitor's hand leads it from the giving hand to the open one.
  const hand = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const handed = useRef(0);
  const settle = useRef(0);
  const [reached, setReached] = useState(false);
  const lead = (value: number) => {
    handed.current = value;
    viewport.current?.style.setProperty("--pass", String(value));
    controller.current?.setHandoff(value);
  };
  useEffect(() => {
    if (!heroOnly || !viewport.current) return;
    const element = viewport.current;
    // Each value is written only when it has changed: the scene becoming ready asks for the places again, and a value written over itself
    // on the stage restyled the whole first screen in the frame of the swap.
    const set = (name: string, value: string) => { if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value); };
    const place = () => {
      const art = host.current?.getBoundingClientRect(), frame = element.getBoundingClientRect();
      if (!art) return;
      // The painting fills its box exactly as the picture and the scene do, so the card is found where it is drawn.
      const mobile = isPaintedPortrait(art.width, art.height);
      const path = cardPath[mobile ? "mobile" : "desktop"];
      const scale = Math.max(art.width / path.size[0], art.height / path.size[1]);
      const paintingWidth = path.size[0] * scale, paintingHeight = path.size[1] * scale;
      const left = art.left - frame.left + (art.width - paintingWidth) / 2, top = art.top - frame.top - (paintingHeight - art.height) * (mobile ? 0 : openingKeptAbove);
      const at = (point: readonly [number, number]) => [left + point[0] * paintingWidth, top + point[1] * paintingHeight];
      const [fromX, fromY] = at(path.from), [toX, toY] = at(path.to);
      set("--card-x", `${fromX}px`); set("--card-y", `${fromY}px`);
      set("--card-dx", `${toX - fromX}px`); set("--card-dy", `${toY - fromY}px`);
      set("--card-size", `${Math.max(72, paintingWidth * .15)}px`);
      // The travelling card's place in the open hand, and the patch of empty hand it leaves behind (thread-card.css).
      const [emptyX, emptyY, emptyWidth, emptyHeight] = path.empty;
      set("--hand-x", `${left + emptyX * scale}px`); set("--hand-y", `${top + emptyY * scale}px`);
      set("--hand-w", `${emptyWidth * scale}px`); set("--hand-h", `${emptyHeight * scale}px`);
      set("--hand-card", `${paintingWidth * path.card}px`);
      element.querySelector<HTMLElement>(".painted-world-hand")?.toggleAttribute("data-tall", mobile);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(settle.current); };
  }, [heroOnly, ready, failed]);
  const takeCard = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || passed) return;
    cancelAnimationFrame(settle.current);
    hand.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setReached(true);
  };
  const carryCard = (event: PointerEvent<HTMLDivElement>) => {
    const held = hand.current, element = viewport.current;
    if (!held || held.id !== event.pointerId || !element) return;
    const dx = parseFloat(element.style.getPropertyValue("--card-dx")), dy = parseFloat(element.style.getPropertyValue("--card-dy"));
    const moveX = event.clientX - held.x, moveY = event.clientY - held.y;
    if (Math.hypot(moveX, moveY) > 6) held.moved = true;
    lead(Math.max(0, Math.min(1, (moveX * dx + moveY * dy) / (dx * dx + dy * dy))));
  };
  const releaseCard = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const held = hand.current;
    if (!held || held.id !== event.pointerId) return;
    hand.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Past halfway, or a plain tap, the card finishes its own way across. Short of it, the card goes back.
    if (!cancelled && (handed.current >= .5 || !held.moved)) { onPass?.(); return; }
    const back = () => {
      const next = handed.current - Math.max(.02, handed.current * .2);
      if (next <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) { handed.current = 0; viewport.current?.style.setProperty("--pass", "0"); controller.current?.setHandoff(null); return; }
      lead(next);
      settle.current = requestAnimationFrame(back);
    };
    back();
  };

  return <main className="painted-world" id="story-start" data-scene={visibleScene} data-hero-only={heroOnly} data-passed={passed} data-ready={ready} data-failed={failed} tabIndex={-1}>
    <a className="painted-world-skip" href={heroOnly ? "#how-neighborly-works" : "#your-community"}>Skip to how Kind Helps works</a>
    {/* Fixed to the screen, and early in the page so a keyboard reaches it before the journey. */}
    <section className="painted-world-track" ref={track} aria-label={heroOnly ? "An open hand" : "A story of care"}>
      <div className="painted-world-viewport" ref={viewport}>
        {/* The sheet the opening leaves on: its wavy foot is a fixed cut that is moved up, with the painting held still inside it (painted-world.css). */}
        <div className="painted-world-lift"><div className="painted-world-sheet">
        {/* The first screen's painting is described once, here; the stills that stand in for it stay silent. */}
        <div className="painted-world-art" ref={host} {...(heroOnly ? { role: "img", "aria-label": "Two people stand side by side. Below them, one hand passes a small card to another's open palm." } : { "aria-hidden": true })} />
        {(!ready || failed) && <picture className="painted-world-fallback">
          {/* The first picture a visitor sees: the lightest file their screen can use, asked for before anything else. */}
          {heroOnly && openingOutcome !== "accepted" && <source media="(max-width:700px)" type="image/avif" srcSet="/assets/living-relief-mobile-480.avif 480w, /assets/living-relief-mobile-780.avif 780w" sizes="100vw" />}
          <source media={heroOnly ? "(max-width:700px)" : "(max-width:700px), (max-width:1000px) and (max-aspect-ratio:9/10)"} srcSet={fallbackSource(visibleScene, true, openingOutcome === "accepted")} />
          {heroOnly && openingOutcome !== "accepted" && <source type="image/avif" srcSet="/assets/living-relief-poster-960.avif 960w, /assets/living-relief-poster-1440.avif 1440w, /assets/living-relief-poster-2880.avif 2880w" sizes="100vw" />}
          {heroOnly && openingOutcome === "accepted" && <source type="image/avif" srcSet={acceptedStill} sizes="100vw" />}
          <img crossOrigin="anonymous" fetchPriority="high" decoding="sync" src={fallbackSource(visibleScene, false, openingOutcome === "accepted")} alt="" />
        </picture>}
        {heroOnly && reached && !passed && (!ready || failed) && <picture className="painted-world-fallback painted-world-fallback-passed">
          <source media="(max-width:700px)" srcSet={fallbackSource("opening", true, true)} />
          <source type="image/avif" srcSet={acceptedStill} sizes="100vw" />
          <img src={fallbackSource("opening", false, true)} alt="" />
        </picture>}
        {heroOnly && onPass && !passed && <div className="painted-world-card" aria-hidden="true" onPointerDown={takeCard} onPointerMove={carryCard} onPointerUp={event => releaseCard(event)} onPointerCancel={event => releaseCard(event, true)} />}
        {heroOnly && <span className="painted-world-hand" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="thread-empty"><img src="/assets/home/hand-empty.webp" srcSet="/assets/home/hand-empty.webp 360w, /assets/home/hand-empty-2x.webp 720w" sizes="28vw" alt="" loading="lazy" decoding="async" /><img src="/assets/home/hand-empty-mobile.webp" alt="" loading="lazy" decoding="async" /></span>
          <span className="card-station" data-station="hand" data-turn={7} />
        </span>}
        <div className="painted-world-shade" aria-hidden="true" />
        <header className="painted-world-header">
          <a href="#story-start" className="painted-world-brand" aria-label="Kind Helps home">kind helps</a>
          <Link href="/app" className="painted-world-enter">Enter Kind Helps <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </header>
        <div className="painted-world-caption" key={visibleScene}>
          <div aria-live="polite" aria-atomic="true">
          <p className="painted-world-kicker" aria-hidden={heroOnly || undefined}>{chapter.name}</p>
          <h1>{chapter.title}</h1>
          <p className="painted-world-description">{chapter.copy}</p>
          </div>
          {heroOnly && <nav className="painted-world-opening-actions" aria-label="Explore Kind Helps">
            <a className="painted-world-primary-invitation" href="#neighborly-courtyard" onClick={event => { if (passed && onContinue) { event.preventDefault(); onContinue(); } else if (!passed && onPass) { event.preventDefault(); onPass(); } }}>{passed || !onPass ? "Go through the doors" : "Pass the card"}</a>
            <Link href="/app?intent=start">Start your conference <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </nav>}
          {!heroOnly && scene === "complete" && <nav className="painted-world-scene-actions" aria-label="Start with Kind Helps">
            <Button asChild className="painted-world-scene-start"><Link href="/app?intent=start">Start your conference <ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
            <Link href="/app?intent=join">Join your people <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href="/app?intent=signin">Sign in</Link>
            <a href="#story-start" className="painted-world-restart">See it again</a>
          </nav>}
        </div>
        <footer className="painted-world-tools">
          <div className="painted-world-scroll-cue" aria-hidden="true" data-waiting={(loading || (!ready && !failed)) || undefined}><span>{/* One line until the scene is whole, then one change: the cue never swaps its words twice. */}{(loading || (!ready && !failed)) ? "Opening the scene" : visibleScene === "complete" ? "Your story starts here" : <>Scroll<span className="painted-world-cue-more"> to continue</span></>}</span><ArrowDown size={15} /></div>
          {!heroOnly && <div className="painted-world-progress" aria-hidden="true"><span>{chapter.number}</span><div><i /></div><span>04</span></div>}
        </footer>
        </div></div>
      </div>
    </section>
    {!heroOnly && <section className="painted-world-end" id="your-community" tabIndex={-1} aria-labelledby="community-title">
      <p className="painted-world-kicker">For every conference</p>
      <h2 id="community-title">Your people.<br /><em>Your way to help.</em></h2>
      <p>A shared place for the plans, people, and acts of care that matter to your community.</p>
      <div className="painted-world-account">
        <Button asChild className="painted-world-start"><Link href="/app?intent=start">Start your conference <ArrowUpRight aria-hidden="true" /></Link></Button>
        <Link href="/app?intent=join">Join your people <ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/app?intent=signin">Sign in</Link>
      </div>
    </section>}
    {heroOnly && children}
  </main>;
}
