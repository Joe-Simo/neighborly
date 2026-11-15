"use client";

import { useEffect, useRef, useState, useImperativeHandle, type Ref } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperSurface } from "./paper-surface";
import { CareInvitation } from "./care-invitation";
import "./neighborly-continuation.css";
import { HallTransitionStudy } from "./hall-transition-study";
import { ThresholdExperience, type ThresholdExperienceHandle } from "./threshold-experience";

const offerings = [
  { title: "Your time", detail: "A little time and care can become something to share.", action: "Join your people", intent: "join" },
  { title: "Your gifts", detail: "Pull up a chair. Make a place for someone to belong.", action: "Join your people", intent: "join" },
  { title: "Your people", detail: "Prepare a welcome for the people who will gather here.", action: "Start a group", intent: "start" },
] as const;

export type NeighborlyContinuationHandle = { openInvitation(trigger: HTMLElement): void; showTable(): void };

export function NeighborlyContinuation({ ref, courtyardOnly = false, spatialChair = false, interior = false, introViewport = false, onOutcome }: { ref?: Ref<NeighborlyContinuationHandle>; courtyardOnly?: boolean; spatialChair?: boolean; interior?: boolean; introViewport?: boolean; onOutcome?: (state: "ready" | "pending" | "accepted" | "declined") => void }) {
  const [planOpen, setPlanOpen] = useState(false);
  const planTrigger = useRef<HTMLElement | null>(null);
  useImperativeHandle(ref, () => ({ openInvitation: (trigger) => { planTrigger.current = trigger; setPlanOpen(true); }, showTable: () => threshold.current?.showTable() }));
  const [invitationOutcome, setInvitationOutcome] = useState<"ready" | "pending" | "accepted" | "declined">("ready");
  const updateOutcome = (state: "ready" | "pending" | "accepted" | "declined") => { setInvitationOutcome(state); };
  const [selected, setSelected] = useState<0 | 1 | 2>(0);
  const root = useRef<HTMLDivElement>(null);
  const threshold = useRef<ThresholdExperienceHandle>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    root.current?.querySelectorAll("[data-reveal]").forEach(element => { if (element.getBoundingClientRect().top < innerHeight) element.classList.add("is-visible"); });
    root.current?.classList.add("has-reveal");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }, { threshold: .12 });
    root.current?.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const offering = offerings[selected];
  return <div className="neighborly-continuation" id="neighborly-courtyard" ref={root}>
    <div className="continuation-backdrop" aria-hidden="true" />
    <ThresholdExperience ref={threshold} selected={selected} onSelect={setSelected} offering={offering} courtyardOnly={courtyardOnly} spatialChair={spatialChair} continueIntoHall={interior} introViewport={introViewport} invitationOutcome={invitationOutcome} onInvitationOutcome={state => { updateOutcome(state); onOutcome?.(state); }} />
    {interior && <HallTransitionStudy embedded onReplay={() => threshold.current?.replay()} />}
    <noscript>
      <style>{`.threshold-journey,.paper-sound-dock,.neighborly-try-plan{display:none!important}`}</style>
      <section className="neighborly-static-story" aria-label="A community of care">
        {/* A native image keeps the story available without client-side code. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/threshold/courtyard-quiet-study-v1.webp" width="1774" height="887" alt="A sunlit church courtyard, with a woman preparing food at a shared table and two people greeting inside the open hall." />
        <div><p className="neighborly-eyebrow">Faith, lived out.</p><h2>Good work.<br /><em>Together.</em></h2><p>Bring something to share. Make room for someone. Welcome your people.</p><a href="#how-neighborly-works">How Kind Helps works <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      </section>
    </noscript>

    <section id="how-neighborly-works" tabIndex={-1} className="neighborly-together" aria-labelledby="together-title">
      <h2 id="together-title" data-reveal>Bring this to<br /><em>your people.</em></h2>
      <div className="neighborly-together-bottom" data-reveal><p>A private place for your community’s<br />teams, plans, and volunteering.</p><div className="neighborly-final-actions"><Button asChild className="neighborly-begin"><Link href="/app?intent=start">Bring your people together<ArrowUpRight aria-hidden="true" /></Link></Button><Link className="neighborly-final-join" href="/app?intent=join">Join your people<ArrowUpRight size={16} aria-hidden="true" /></Link></div></div>
      <Button variant="ghost" className="neighborly-try-plan" onClick={event => { planTrigger.current = event.currentTarget; setPlanOpen(true); }}>Try a shared plan<ArrowUpRight size={16} aria-hidden="true" /></Button>
      <footer className="neighborly-colophon"><a href="#story-start">kind helps</a><span>Made for the good we can do. Free for every group. <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">Give a gift</a></span><Link href="/app?intent=signin">Sign in<ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
    </section>
    <PaperSurface open={planOpen} onOpenChange={setPlanOpen} title="A place at the table." variant="invitation" onExited={() => onOutcome?.(invitationOutcome)} returnFocusRef={planTrigger}><CareInvitation compact state={invitationOutcome} onOutcome={updateOutcome} /></PaperSurface>
  </div>;
}
