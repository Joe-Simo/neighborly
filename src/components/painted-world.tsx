"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaintedScoreControl } from "@/components/painted-score-control";
import { getPaintedScrollState } from "@/lib/painted-world-scroll";
import type { PaintedScene, PaintedWorldOptions, createPaintedWorldController } from "@/lib/painted-world-controller";
import "./painted-world.css";
import { useExperienceSound } from "./experience-sound-context";

const chapters = {
  opening: { number: "01", name: "An open hand", title: <>Good things begin<br />with <em>an open hand.</em></>, copy: "A little care can go a long way." },
  meal: { number: "02", name: "A meal shared", title: <>A meal,<br /><em>made together.</em></>, copy: "A meal becomes more when it is shared." },
  visit: { number: "03", name: "A visit made", title: <>A knock.<br /><em>A familiar face.</em></>, copy: "Bring a meal. Stay for a conversation." },
  welcome: { number: "04", name: "A welcome offered", title: <>A place<br /><em>for everyone.</em></>, copy: "Small acts of care become a community." },
  complete: { number: "04", name: "Good work, together", title: <>Good work,<br /><em>together.</em></>, copy: "Organize the next act of care with your church or community." },
} as const;
function fallbackSource(scene: PaintedScene, mobile: boolean, narrow = false, accepted = false) {
  if (scene === "opening" && accepted) return narrow ? "/assets/living-relief-narrow-accepted.webp" : mobile ? "/assets/living-relief-mobile-accepted.webp" : "/assets/living-relief-accepted.webp";
  if (scene === "opening") return mobile ? narrow ? "/assets/living-relief-narrow.webp" : "/assets/living-relief-mobile.webp" : "/assets/living-relief-poster.webp";
  return `/assets/painted-world/${scene === "complete" ? "welcome" : scene}${mobile ? "-mobile" : ""}.webp`;
}
type Controller = Pick<ReturnType<typeof createPaintedWorldController>, "setStoryProgress" | "setOpeningOutcome" | "setReducedMotion" | "dispose">;

/** Native scrolling owns the narrative; the artwork never traps wheel or touch input. */
export function PaintedWorld({ scenes, heroOnly = false, suspendOffscreen = false, openingOutcome = "rest", onOpenInvitation, onSeeTogether, children }: { scenes?: PaintedWorldOptions["scenes"]; heroOnly?: boolean; suspendOffscreen?: boolean; openingOutcome?: "rest" | "pending" | "accepted" | "declined"; onOpenInvitation?: (trigger: HTMLElement) => void; onSeeTogether?: () => void; children?: ReactNode }) {
  const sound = useExperienceSound();
  const outcomeRef = useRef(openingOutcome);
  useEffect(() => { outcomeRef.current = openingOutcome; controller.current?.setOpeningOutcome(openingOutcome); }, [openingOutcome]);
  const track = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const progress = useRef(0);
  const fallbackRef = useRef(false);
  const [scene, setScene] = useState<PaintedScene>("opening");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [onscreen, setOnscreen] = useState(true);
  const canRender = !heroOnly || !suspendOffscreen || onscreen;
  useEffect(() => {
    if (!heroOnly || !suspendOffscreen || !viewport.current || !("IntersectionObserver" in window)) return;
    let previous: boolean | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      if (visible === previous) return;
      previous = visible;
      setOnscreen(visible);
      if (!visible) setReady(false);
      if (!visible) { controller.current?.dispose(); controller.current = null; setLoading(false); }
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [heroOnly, suspendOffscreen]);
  const visibleScene = heroOnly ? "opening" : scene;
  const chapter = chapters[visibleScene];

  useEffect(() => {
    if (!canRender) return;
    let disposed = false;
    let active: Controller | undefined;
    let idle: number | undefined;
    let defer: ReturnType<typeof setTimeout> | undefined;
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
    const enhance = () => { void import("@/lib/painted-world-controller").then(({ createPaintedWorldController: createController }) => {
      if (disposed || !host.current) return;
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
    // dimensional guide after critical text and imagery have had time to paint.
    if (heroOnly) {
      defer = setTimeout(() => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(enhance, { timeout: 2000 });
        else enhance();
      }, 1200);
    } else enhance();
    return () => {
      disposed = true;
      clearTimeout(defer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      active?.dispose(); controller.current = null;
    };
  }, [scenes, heroOnly, canRender]);

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

  return <main className="painted-world" id="story-start" data-scene={visibleScene} data-hero-only={heroOnly} data-ready={ready} data-failed={failed} tabIndex={-1}>
    {heroOnly && <h1 className="sr-only">Neighborly — good work, together.</h1>}
    <a className="painted-world-skip" href={heroOnly ? "#how-neighborly-works" : "#your-community"}>Skip to how Neighborly works</a>
    <section className="painted-world-track" ref={track} aria-label={heroOnly ? "An open hand" : "A story of care"}>
      <div className="painted-world-viewport" ref={viewport}>
        <div className="painted-world-art" ref={host} aria-hidden="true" />
        {(!ready || failed || !canRender) && <picture className="painted-world-fallback">
          <source media="(max-width:420px)" srcSet={fallbackSource(visibleScene, true, true, openingOutcome === "accepted")} />
          <source media="(max-width:700px), (max-width:1000px) and (max-aspect-ratio:9/10)" srcSet={fallbackSource(visibleScene, true, false, openingOutcome === "accepted")} />
          <img crossOrigin="anonymous" src={fallbackSource(visibleScene, false, false, openingOutcome === "accepted")} alt="" />
        </picture>}
        <div className="painted-world-shade" aria-hidden="true" />
        <header className="painted-world-header">
          <a href="#story-start" className="painted-world-brand" aria-label="Neighborly home">neighborly</a>
          <Link href="/app" className="painted-world-enter">Enter Neighborly <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </header>
        <div className="painted-world-caption" key={visibleScene}>
          <div aria-live="polite" aria-atomic="true">
          <p className="painted-world-kicker" aria-hidden={heroOnly || undefined}>{chapter.name}</p>
          <h1 aria-level={heroOnly ? 2 : undefined}>{heroOnly && openingOutcome === "accepted" ? <>A little yes.<br /><em>Something shared.</em></> : heroOnly && openingOutcome === "declined" ? <>There is room<br /><em>for another answer.</em></> : chapter.title}</h1>
          <p className="painted-world-description">{heroOnly && openingOutcome === "accepted" ? "A small promise. One less thing to carry alone." : heroOnly && openingOutcome === "declined" ? "The invitation stays open. Everyone still belongs." : chapter.copy}</p>
          </div>
          {heroOnly && <nav className="painted-world-opening-actions" aria-label="Explore Neighborly">
            <a className="painted-world-primary-invitation" href="#neighborly-courtyard" aria-haspopup={onOpenInvitation && openingOutcome !== "accepted" ? "dialog" : undefined} onClick={event => { if (openingOutcome === "accepted" && onSeeTogether) { event.preventDefault(); onSeeTogether(); } else if (onOpenInvitation && openingOutcome !== "accepted") { event.preventDefault(); onOpenInvitation(event.currentTarget); } }}>{openingOutcome === "accepted" ? "See what comes together" : openingOutcome === "declined" ? "Try another answer" : onOpenInvitation ? "Open the invitation" : "Step inside"}<ArrowUpRight size={15} aria-hidden="true" /></a>
            <Link href="/app?intent=start">Start a group <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </nav>}
          {!heroOnly && scene === "complete" && <nav className="painted-world-scene-actions" aria-label="Start with Neighborly">
            <Button asChild className="painted-world-scene-start"><Link href="/app?intent=start">Start a group <ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
            <Link href="/app?intent=join">Join your people <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href="/app?intent=signin">Sign in</Link>
            <a href="#story-start" className="painted-world-restart">Experience again</a>
          </nav>}
        </div>
        <footer className="painted-world-tools">
          {!heroOnly && <PaintedScoreControl scene={visibleScene} className="painted-world-sound" />}
          <div className="painted-world-scroll-cue" aria-hidden="true"><span>{loading ? "Opening the scene" : visibleScene === "complete" ? "Your story starts here" : "Scroll to continue"}</span><ArrowDown size={15} /></div>
          {!heroOnly && <div className="painted-world-progress" aria-hidden="true"><span>{chapter.number}</span><div><i /></div><span>04</span></div>}
        </footer>
      </div>
    </section>
    {!heroOnly && <section className="painted-world-end" id="your-community" tabIndex={-1} aria-labelledby="community-title">
      <p className="painted-world-kicker">For churches and communities</p>
      <h2 id="community-title">Your people.<br /><em>Your way to help.</em></h2>
      <p>A shared place for the plans, people, and acts of care that matter to your community.</p>
      <div className="painted-world-account">
        <Button asChild className="painted-world-start"><Link href="/app?intent=start">Start a group <ArrowUpRight aria-hidden="true" /></Link></Button>
        <Link href="/app?intent=join">Join your people <ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/app?intent=signin">Sign in</Link>
      </div>
    </section>}
    {heroOnly && <div className="paper-sound-dock"><PaintedScoreControl scene={sound?.scene ?? visibleScene} className="painted-world-sound" /></div>}
    {heroOnly && children}
  </main>;
}
