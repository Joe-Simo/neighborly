"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref, type CSSProperties, type PointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, RotateCcw, Sun, Moon, Check } from "lucide-react";
import { CourtyardSpatialChair } from "./courtyard-spatial-chair";
import { Button } from "@/components/ui/button";
import { PaperSurface } from "./paper-surface";
import { CareInvitation } from "./care-invitation";
import { LivingCourtyard } from "./living-courtyard";
import "./threshold-experience.css";
import { useExperienceSound } from "./experience-sound-context";
import { getScrollCareCue, type ScrollCareCompletion } from "@/lib/scroll-care-cue";
import { getDepthEntryFrame, finalReady } from "@/lib/depth-entry";
import type { createCourtyardMotion } from "@/lib/courtyard-motion";

type Choice = 0 | 1 | 2;
type Offering = { detail: string; action: string; intent: "join" | "start" };
// The share of the journey spent passing through the doorway, and where the garden comes to rest after it.
const doorSpan = .2;
const gardenRest = .22;
const destinations = ["Tend the garden", "Make room", "Welcome people"] as const;
const storyHeadings = ["Something to share.", "A place for one more.", "Someone to welcome."] as const;
const storyCopy = ["What grows here can nourish someone else.", "A little care becomes a meal, and a meal becomes time together.", "The same care opens a door and makes room for people."] as const;

export type ThresholdExperienceHandle = { replay(): void; showTable(): void };

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function canUseWebGL() {
  return !new URLSearchParams(window.location.search).has("noWebGL");
}

function serverWebGLSnapshot() { return false; }

export function ThresholdExperience({ ref, selected, onSelect, offering, courtyardOnly = false, spatialChair = false, continueIntoHall = false, introViewport = false, invitationOutcome: controlledInvitationOutcome, onInvitationOutcome }: { ref?: Ref<ThresholdExperienceHandle>; selected: Choice; onSelect(value: Choice): void; offering: Offering; courtyardOnly?: boolean; spatialChair?: boolean; continueIntoHall?: boolean; introViewport?: boolean; invitationOutcome?: "ready" | "pending" | "accepted" | "declined"; onInvitationOutcome?: (state: "ready" | "pending" | "accepted" | "declined") => void }) {
  const sound = useExperienceSound();
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  const lastScrollCare = useRef<ScrollCareCompletion | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [exploringAfterAnswer, setExploringAfterAnswer] = useState(false);
  const [localInvitationOutcome, setLocalInvitationOutcome] = useState<"ready" | "pending" | "accepted" | "declined">("ready");
  const invitationOutcome = controlledInvitationOutcome ?? localInvitationOutcome;
  const updateInvitationOutcome = onInvitationOutcome ?? setLocalInvitationOutcome;

  const invitationTrigger = useRef<HTMLElement | null>(null);
  const journey = useRef<HTMLDivElement>(null);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const webglAllowed = useSyncExternalStore(subscribeToLocation, canUseWebGL, serverWebGLSnapshot);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const doorTravel = useRef<number | null>(null);
  const scrollFrame = useRef(0);
  const journeyProgress = useRef(0);
  const journeyPhase = useRef<"before" | "inside" | null>(null);
  const journeyChapter = useRef<number | null>(null);
  const [baseReady, setBaseReady] = useState(false);
  const [baseFailed, setBaseFailed] = useState(false);
  const [figuresFailed, setFiguresFailed] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);
  useEffect(() => { if (!baseReady || !openRequested) return; const frame = requestAnimationFrame(() => { setOpen(true); setOpenRequested(false); }); return () => cancelAnimationFrame(frame); }, [baseReady, openRequested]);
  const requestOpen = () => { if (baseReady) setOpen(true); else setOpenRequested(true); };
  const alignStage = () => {
    if (!host.current) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = journey.current;
    if (target) {
      const height = host.current.getBoundingClientRect().height;
      const intro = introViewport ? height : 0;
      const distance = Math.max(1, target.getBoundingClientRect().height - height - intro);
      window.scrollTo({ top: target.getBoundingClientRect().top + scrollY + intro + distance * gardenRest, behavior: reduce ? "instant" : "smooth" });
    }
  };
  const [nearby, setNearby] = useState(false);
  const [assetStage, setAssetStage] = useState<Choice>(selected);
  const tableMounted = assetStage >= 1 || selected >= 1 || invitationOutcome !== "ready";
  const hallMounted = assetStage >= 2 || selected === 2;
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setNearby(true)); return () => cancelAnimationFrame(frame); }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNearby(true); observer.disconnect(); } }, { rootMargin: "0px 0px 12% 0px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // Persist destinations requested by parent navigation after their first render.
    const frame = requestAnimationFrame(() => setAssetStage(stage => Math.max(stage, selected) as Choice));
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  const [evening, setEvening] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [overview, setOverview] = useState(false);
  const [acting, setActing] = useState(false);
  const [motionUnavailable, setMotionUnavailable] = useState(false);
  const [chairProgress, setChairProgress] = useState(0);
  const chairDragged = useRef(false);
  const gestureDestination = useRef<Choice>(selected);
  const chairGesture = useRef<{ x: number; y: number; dragging: boolean; pointerId: number; target: HTMLButtonElement } | null>(null);
  const cancelChair = () => {
    const gesture = chairGesture.current; chairGesture.current = null;
    if (gesture?.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
    if (gesture) { releaseCare(); chairDragged.current = true; motion.current?.returnCare(gestureDestination.current); setChairProgress(0); }
  };
  const beginChair = (event: PointerEvent<HTMLButtonElement>) => {
    if (!motion.current || !event.isPrimary || event.button !== 0 || acting) return;
    settleNavigation();
    explicitCare.current = true;
    gestureDestination.current = selected;
    chairDragged.current = false;
    chairGesture.current = { x: event.clientX, y: event.clientY, dragging: false, pointerId: event.pointerId, target: event.currentTarget };
  };
  const moveChair = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = chairGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { cancelChair(); return; }
      if (Math.abs(dx) < 8) return;
      gesture.dragging = true; chairDragged.current = true; event.currentTarget.setPointerCapture(event.pointerId);
    }
    const value = Math.max(0, Math.min(1, dx / 100));
    setChairProgress(value); motion.current?.scrubCare(selected, value);
  };
  const finishChair = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = chairGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    chairGesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setChairProgress(0);
    if (!cancelled && gesture.dragging && event.clientX - gesture.x > 45 && motion.current) {
      setActing(true);
      actionCancel.current = motion.current.completeCare(selected, () => { setCare(values => values.map((value, index) => index === selected ? true : value) as [boolean, boolean, boolean]); sound?.cue(selected === 0 ? "visit" : selected === 1 ? "meal" : "welcome"); }, () => { setActing(false); actionCancel.current = null; releaseCare(); });
    } else { motion.current?.returnCare(selected); releaseCare(); }
  };
  const actionCancel = useRef<(() => void) | null>(null);
  const explicitCare = useRef(false);
  const releaseCare = () => { explicitCare.current = false; };
  const pendingFocus = useRef<{ target: "result" | "handle"; destination: Choice; source: Element | null } | null>(null);
  const resultControl = useRef<HTMLButtonElement>(null);
  const handleControl = useRef<HTMLButtonElement>(null);
  const [care, setCare] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [assetState, setAssetState] = useState<Record<string, boolean>>({});
  const [assetErrors, setAssetErrors] = useState<Record<string, boolean>>({});
  const assetFailed = [["basket","plants"],courtyardOnly ? ["chair","settings","response"] : ["chair","settings"],["chairs","flowers","hallResponse"]][selected].some(name => assetErrors[name]);
  const [assetAttempts, setAssetAttempts] = useState<Record<string, number>>({});
  const [baseAttempt, setBaseAttempt] = useState(0);
  const loaded = [assetState.basket && assetState.plants, assetState.chair && assetState.settings && (!courtyardOnly || assetState.response), assetState.chairs && assetState.flowers && assetState.hallResponse];
  const active = care[selected];
  useEffect(() => {
    if (acting || !pendingFocus.current) return;
    if (pendingFocus.current.destination !== selected) { pendingFocus.current = null; return; }
    const focused = document.activeElement;
    if (focused !== document.body && focused !== pendingFocus.current.source) { pendingFocus.current = null; return; }
    const target = pendingFocus.current.target === "result" ? resultControl.current : handleControl.current;
    if (target) { target.focus({ preventScroll: true }); pendingFocus.current = null; }
  }, [acting, active, selected]);
  useEffect(() => {
    sound?.setScene(!open ? "opening" : overview ? "complete" : selected === 0 ? "visit" : selected === 1 ? "meal" : "welcome");
  }, [open, overview, selected, sound]);
  const actionLabels = ["Bring something to share", "Make room at the table", "Prepare a welcome"] as const;
  const resetLabels = ["Reset the garden", "Reset the table", "Reset the hall"] as const;
  const resultCopy = ["A basket to share. A meal to plan together.", "A place is ready. Bring your people around the table.", "A welcome is ready. Gather the people who will make it happen."] as const;
  const settleNavigation = () => {
    // Complete the doorway approach before an explicit gesture takes the scene.
    // Stopping early would otherwise leave the door layer covering the action.
    if (!journey.current || !host.current) return;
    const element = host.current;
    const bounds = journey.current.getBoundingClientRect();
    const height = element.getBoundingClientRect().height;
    const intro = introViewport ? height : 0;
    const distance = Math.max(1, bounds.height - height - intro);
    const value = Math.max(gardenRest, Math.min(1, (-bounds.top - intro) / distance));
    window.scrollTo({ top: bounds.top + window.scrollY + intro + distance * value, left: window.scrollX, behavior: "instant" });
    cancelAnimationFrame(scrollFrame.current);
    const next = continueIntoHall ? Math.min(.94, value) : value;
    doorTravel.current = 1;
    journeyProgress.current = next;
    element.style.setProperty("--door-progress", "1");
    element.setAttribute("data-entering", "false");
    motion.current?.setJourneyProgress(next);
  };
  const toggleCare = (keyboard = false) => {
    settleNavigation();
    explicitCare.current = true;
    if (keyboard) pendingFocus.current = { target: active ? "handle" : "result", destination: selected, source: document.activeElement };
    setQuiet(false); setOverview(false);
    actionCancel.current?.();
    const destination = selected;
    const reveal = () => { setCare(values => values.map((value, index) => index === destination ? !value : value) as [boolean, boolean, boolean]); if (!active) sound?.cue(destination === 0 ? "visit" : destination === 1 ? "meal" : "welcome"); };
    if (active && motion.current) {
      setActing(true);
      actionCancel.current = motion.current.clearCare(destination, () => { reveal(); setActing(false); actionCancel.current = null; releaseCare(); });
      return;
    }
    if (!motion.current) {
      const keys = [["--garden-basket","--garden-plants"],["--table-chair","--table-settings"],["--hall-chairs","--hall-flowers"]][destination];
      keys.forEach(key => host.current?.style.setProperty(key, active ? "0" : "1"));
      reveal(); releaseCare(); return;
    }
    setActing(true);
    actionCancel.current = motion.current.playCare(destination, reveal, () => { setActing(false); actionCancel.current = null; releaseCare(); });
  };
  const markLoaded = (name: string) => { setAssetState(values => values[name] ? values : ({ ...values, [name]: true })); setAssetErrors(values => values[name] ? ({ ...values, [name]: false }) : values); };
  const markFailed = (name: string) => {
    setAssetState(values => values[name] ? ({ ...values, [name]: false }) : values);
    setAssetErrors(values => values[name] ? values : ({ ...values, [name]: true }));
  };
  const retryArtwork = () => {
    const failed = Object.keys(assetErrors).filter(name => assetErrors[name]);
    setAssetAttempts(values => { const next = { ...values }; failed.forEach(name => { next[name] = (next[name] ?? 0) + 1; }); return next; });
    setAssetState(values => { const next = { ...values }; failed.forEach(name => { next[name] = false; }); return next; });
    setAssetErrors(values => { const next = { ...values }; failed.forEach(name => { next[name] = false; }); return next; });
  };
  const host = useRef<HTMLElement>(null);
  const motion = useRef<ReturnType<typeof createCourtyardMotion> | null>(null);
  const current = useRef({ open, selected, onSelect });
  const acceptedRef = useRef(invitationOutcome === "accepted");
  useEffect(() => { acceptedRef.current = invitationOutcome === "accepted"; motion.current?.setInvitationAccepted(acceptedRef.current); }, [invitationOutcome]);
  useEffect(() => {
    current.current = { open, selected, onSelect };
    motion.current?.setOpen(open);
  }, [open, selected, onSelect]);
  useEffect(() => {
    const update = () => {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        if (!journey.current || !host.current || explicitCare.current) return;
        const bounds = journey.current.getBoundingClientRect();
        const height = host.current.getBoundingClientRect().height;
        const intro = introViewport ? height : 0;
        const distance = Math.max(1, bounds.height - height - intro);
        const elapsed = -bounds.top - intro;
        const progress = Math.max(0, Math.min(1, elapsed / distance));
        const storyProgress = continueIntoHall ? Math.min(.94, progress) : progress;
        journeyProgress.current = storyProgress;

        const approaching: Choice = progress >= .6 ? 2 : progress >= .25 ? 1 : 0;
        setAssetStage(stage => Math.max(stage, approaching) as Choice);
        doorTravel.current = progress > 0 ? Math.min(1, progress / doorSpan) : null;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        host.current.dataset.finalFramed = String(finalReady(storyProgress, reduced));
        if (host.current.dataset.baseReady === "true") host.current.style.setProperty("--door-progress", String(reduced ? progress > .025 ? 1 : 0 : doorTravel.current ?? 0));
        host.current.dataset.entering = String(progress > 0 && progress < doorSpan);
        const phase = (courtyardOnly && elapsed >= 0) || progress > .025 ? "inside" : "before";
        if (phase !== journeyPhase.current) {
          journeyPhase.current = phase;
          setJourneyStarted(phase === "inside");
          setOpenRequested(phase === "inside");
          if (phase === "before") setOpen(false);
        }
        if (phase === "before") return;
        const destination: Choice = progress < .385 ? 0 : progress < .73 ? 1 : 2;
        current.current.onSelect(destination);
        const chapter = storyProgress > .95 ? 3 : destination;
        if (chapter !== journeyChapter.current) {
          journeyChapter.current = chapter;
          setOverview(chapter === 3); setQuiet(chapter === 3);
        }
        host.current.style.setProperty("--journey-travel", String(progress > .32 && progress < .45 || progress > .66 && progress < .8 ? 1 : 0));
        host.current.dataset.travelling = String(progress > .32 && progress < .45 || progress > .66 && progress < .8);
        if (courtyardOnly) {
          const travel = elapsed / height;
          const entry = getDepthEntryFrame(travel, reduced);
          host.current.dataset.depthArriving = String(!entry.arrived);
          motion.current?.setDepthEntry(travel);
        }
        motion.current?.setJourneyProgress(storyProgress);
      });
    };
    const observer = new ResizeObserver(update);
    if (journey.current) observer.observe(journey.current);
    if (host.current) observer.observe(host.current);
    const resumeJourney = () => { releaseCare(); update(); };
    const resumeWithKey = (event: KeyboardEvent) => {
      if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "].includes(event.key) && !(event.target instanceof Element && event.target.closest("button,input,textarea,select,[contenteditable=true]"))) resumeJourney();
    };
    window.addEventListener("wheel", resumeJourney, { passive: true });
    window.addEventListener("touchmove", resumeJourney, { passive: true });
    window.addEventListener("keydown", resumeWithKey);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
    motionMedia.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("wheel", resumeJourney); window.removeEventListener("touchmove", resumeJourney); window.removeEventListener("keydown", resumeWithKey); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); motionMedia.removeEventListener("change", update); cancelAnimationFrame(scrollFrame.current); };
  }, [courtyardOnly, continueIntoHall, introViewport]);
  useEffect(() => {
    if (!nearby) return;
    let disposed = false;
    void import("@/lib/courtyard-motion").then(({ createCourtyardMotion }) => {
      if (disposed || !host.current) return;
      motion.current = createCourtyardMotion(host.current, { responseFocus: courtyardOnly, scrollCare: courtyardOnly, onScrollCare: values => {
        const cue = getScrollCareCue(lastScrollCare.current, values);
        lastScrollCare.current = values;
        setCare(previous => previous.every((value, index) => value === values[index]) ? previous : [...values]);
        if (cue !== null) soundRef.current?.cue(cue === 0 ? "visit" : cue === 1 ? "meal" : "welcome");
      }, onDestination: value => current.current.onSelect(value) });
      motion.current.setDestination(current.current.selected); motion.current.setOpen(current.current.open); motion.current.setInvitationAccepted(acceptedRef.current);
      if (courtyardOnly && journey.current && host.current) motion.current.setDepthEntry(-journey.current.getBoundingClientRect().top / host.current.getBoundingClientRect().height - (introViewport ? 1 : 0));
      motion.current.setJourneyProgress(journeyProgress.current);
    }).catch(() => { if (!disposed) setMotionUnavailable(true); });
    return () => { disposed = true; actionCancel.current = null; motion.current?.dispose(); motion.current = null; };
  }, [courtyardOnly, continueIntoHall, introViewport, nearby]);
  useEffect(() => {
    if (!motionUnavailable || !host.current) return;
    const element = host.current;
    const layout = () => {
      const { width, height } = element.getBoundingClientRect();
      const sceneHeight = Math.max(height, width / 2) * 1.16;
      const sceneWidth = sceneHeight * 2;
      const range = Math.max(0, (sceneWidth - width) / 2);
      const position = overview ? 0 : [.86, 0, -.86][selected];
      element.style.setProperty("--scene-width", `${sceneWidth}px`);
      element.style.setProperty("--scene-height", `${sceneHeight}px`);
      element.style.setProperty("--scene-x", `${position * range * .95}px`);
      element.style.setProperty("--fore-x", `${position * range * .95}px`);
      element.style.setProperty("--scene-y", "0px");
      element.style.setProperty("--fore-y", "0px");
      element.style.setProperty("--harvest-transfer", overview || selected !== 0 ? "1" : "0");
      element.style.setProperty("--harvest-placement", overview || selected !== 0 ? "1" : "0");
      element.style.setProperty("--harvest-opacity", "1");
    };
    layout();
    const observer = new ResizeObserver(layout); observer.observe(element);
    return () => observer.disconnect();
  }, [motionUnavailable, selected, overview]);
  useEffect(() => {
    // The painted layers answer the visitor's hand: near leaves move further than the far wall.
    const element = host.current;
    if (!element || reducedMotion || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0, x = 0, y = 0, targetX = 0, targetY = 0;
    const settle = () => {
      x += (targetX - x) * .08; y += (targetY - y) * .08;
      element.style.setProperty("--look-x", x.toFixed(4)); element.style.setProperty("--look-y", y.toFixed(4));
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > .002 ? requestAnimationFrame(settle) : 0;
    };
    const look = (event: MouseEvent) => {
      const bounds = element.getBoundingClientRect();
      targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1; targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      if (!frame) frame = requestAnimationFrame(settle);
    };
    element.addEventListener("pointermove", look, { passive: true });
    return () => { cancelAnimationFrame(frame); element.removeEventListener("pointermove", look); element.style.removeProperty("--look-x"); element.style.removeProperty("--look-y"); };
  }, [reducedMotion]);
  useEffect(() => {
    // Secondary controls step back while the visitor is simply looking, and return at the first movement.
    const element = host.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      element.setAttribute("data-resting", "false");
      clearTimeout(timer);
      timer = setTimeout(() => { if (document.activeElement === element || !element.contains(document.activeElement)) element.setAttribute("data-resting", "true"); }, 3200);
    };
    const events = ["pointermove", "pointerdown", "keydown", "focusin", "touchstart"] as const;
    events.forEach(name => window.addEventListener(name, wake, { passive: true }));
    wake();
    return () => { clearTimeout(timer); events.forEach(name => window.removeEventListener(name, wake)); element.removeAttribute("data-resting"); };
  }, []);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; progress: number; moved: boolean } | null>(null);
  const progress = courtyardOnly && baseReady ? 1 : baseReady ? reducedMotion ? open ? 1 : 0 : drag ?? (open ? 1 : 0) : 0;
  useEffect(() => {
    if (drag === null && doorTravel.current !== null && baseReady) host.current?.style.setProperty("--door-progress", String(reducedMotion ? open ? 1 : 0 : doorTravel.current));
  }, [baseReady, reducedMotion, open, drag]);
  const resetGesture = useEffectEvent(() => { start.current = null; setDrag(null); cancelChair(); });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", resetGesture);
    document.addEventListener("visibilitychange", resetGesture);
    return () => { media.removeEventListener("change", resetGesture); document.removeEventListener("visibilitychange", resetGesture); };
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (open || !baseReady || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, progress, moved: false };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
    origin.moved = true;
    setDrag(Math.min(1, Math.abs(dx) / Math.max(130, event.currentTarget.clientWidth * .35)));
  };
  const finish = () => {
    if (start.current?.moved) setOpen(progress > .35);
    start.current = null; setDrag(null);
  };
  const cancel = () => { start.current = null; setDrag(null); };
  const choose = (value: Choice, instant = false) => {
    if (invitationOutcome === "accepted") setExploringAfterAnswer(true);
    releaseCare();
    pendingFocus.current = null;
    if (journey.current) {
      const height = host.current?.getBoundingClientRect().height ?? 0;
      const intro = introViewport ? height : 0;
      const distance = Math.max(1, journey.current.getBoundingClientRect().height - height - intro);
      const targetProgress = [gardenRest, .55, .9][value];
      window.scrollTo({ top: journey.current.getBoundingClientRect().top + scrollY + intro + distance * targetProgress, behavior: instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
 actionCancel.current?.(); cancelChair(); if (!care[selected]) motion.current?.resetCare(selected); setActing(false); setOverview(false); setQuiet(false); requestOpen(); motion.current?.setDestination(value); onSelect(value); };
  const doorwayTrack = () => courtyardOnly
    ? host.current?.closest(".depth-experience-candidate")?.querySelector<HTMLElement>(".doorway-depth-track") ?? journey.current
    : journey.current;
  const backToDoorway = () => {
    releaseCare();
    actionCancel.current?.(); cancelChair(); cancel();
    setActing(false); setOpen(false); setOpenRequested(false);
    const target = doorwayTrack();
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + scrollY, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const replay = () => {
    setExploringAfterAnswer(false);
    updateInvitationOutcome("ready");
    releaseCare();
    actionCancel.current?.(); cancelChair(); cancel();
    pendingFocus.current = null;
    for (const destination of [0, 1, 2] as const) motion.current?.resetCare(destination);
    lastScrollCare.current = undefined;
    setCare([false, false, false]); setActing(false); setOverview(false); setQuiet(false);
    setOpen(false); setOpenRequested(false); setEvening(false); onSelect(0);
    journeyPhase.current = "before"; journeyChapter.current = null; journeyProgress.current = 0; doorTravel.current = null;
    setJourneyStarted(false); motion.current?.setOpen(false); motion.current?.setJourneyProgress(0);
    const target = doorwayTrack();
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + scrollY, behavior: "instant" });
    if (courtyardOnly) target?.focus({ preventScroll: true });
    else requestAnimationFrame(() => host.current?.querySelector<HTMLButtonElement>(".threshold-open")?.focus({ preventScroll: true }));
  };
  useImperativeHandle(ref, () => ({ replay, showTable: () => { choose(1, true); setExploringAfterAnswer(false); } }));
  return <div ref={journey} className="threshold-journey" data-started={journeyStarted} data-intro-viewport={introViewport} tabIndex={-1}><section ref={host} className="threshold-experience" id="your-community" aria-label="Explore the Neighborly courtyard" aria-describedby="courtyard-description" data-courtyard-only={courtyardOnly} data-scroll-care={courtyardOnly} data-invitation={invitationOutcome} data-answer-focus={invitationOutcome === "accepted" && selected === 1 && !exploringAfterAnswer} data-base-ready={baseReady} data-motion-unavailable={motionUnavailable} data-open={open} data-evening={evening} data-quiet={quiet} data-overview={overview} data-nearby={nearby} data-acting={acting} data-care-complete={active && !acting} data-chair-dragging={chairProgress > 0} data-garden-ready={care[0]} data-table-ready={care[1]} data-hall-ready={care[2]} data-dragging={drag !== null} data-destination={selected} style={{ "--door-progress": progress } as CSSProperties}>
    <p id="courtyard-description" className="sr-only">A painted church courtyard connects a garden, a shared table, and an open hall. Scroll to explore, or use the chapter buttons. Scroll or swipe to follow the acts of care. You can also use each object’s button to explore its gesture.</p>
    {!courtyardOnly && <LivingCourtyard />}
    {nearby && <div className="threshold-world">
      <Image width={1774} height={887} unoptimized loading="eager" aria-hidden="true" key={`base-${baseAttempt}`} className="threshold-background" onLoad={() => { setBaseReady(true); setBaseFailed(false); if (openRequested) { setOpen(true); setOpenRequested(false); } }} onError={() => { setBaseReady(false); setBaseFailed(true); setOpenRequested(false); }} src={`/assets/threshold/${figuresFailed ? "courtyard-quiet-study-v1" : "courtyard-quiet-plate-v1"}.webp?v=${baseAttempt}`} alt="" />
      {!figuresFailed && ["woman", "couple"].map(figure => <div key={figure} className={`threshold-figure threshold-figure-${figure}`} aria-hidden="true"><Image width={1774} height={887} unoptimized loading="eager" onError={() => setFiguresFailed(true)} src={`/assets/threshold/courtyard-${figure}-v1.webp`} alt="" /></div>)}
      {hallMounted && <Image width={1774} height={887} unoptimized loading="eager" key={`hall-response-${assetAttempts.hallResponse ?? 0}`} className="threshold-hall-response" onLoad={() => markLoaded("hallResponse")} onError={() => markFailed("hallResponse")} src={`/assets/threshold/${courtyardOnly ? "hall-welcome-v1" : "hall-response-v1"}.webp?v=${assetAttempts.hallResponse ?? 0}`} alt="" />}
      {tableMounted && <Image width={1774} height={887} unoptimized loading="eager" key={`welcome-${assetAttempts.welcome ?? 0}`} className="threshold-table-welcome" onLoad={() => markLoaded("welcome")} onError={() => markFailed("welcome")} src={`/assets/threshold/table-welcome-v2.webp?v=${assetAttempts.welcome ?? 0}`} alt="" aria-hidden="true" />}
      {tableMounted && courtyardOnly && <Image width={1774} height={887} unoptimized loading="eager" key={`response-${assetAttempts.response ?? 0}`} className="threshold-table-response" onLoad={() => markLoaded("response")} onError={() => markFailed("response")} src={`/assets/threshold/${courtyardOnly ? "table-offering-v1" : "table-response-v1"}.webp?v=${assetAttempts.response ?? 0}`} alt="" />}
      {tableMounted && <Image width={1774} height={887} unoptimized loading="eager" key={`settings-${assetAttempts.settings ?? 0}`} className="threshold-table-settings" onError={() => markFailed("settings")} onLoad={() => markLoaded("settings")} src={`/assets/threshold/table-settings.webp?v=${assetAttempts.settings ?? 0}`} alt="" />}
      {tableMounted && <Image width={1774} height={887} unoptimized loading="eager" key={`chair-${assetAttempts.chair ?? 0}`} className="threshold-table-chair" onError={() => markFailed("chair")} onLoad={() => markLoaded("chair")} src={`/assets/threshold/table-chair.webp?v=${assetAttempts.chair ?? 0}`} alt="" />}
      <Image width={1774} height={887} unoptimized loading="eager" key={`basket-${assetAttempts.basket ?? 0}`} className="threshold-garden-basket" onError={() => markFailed("basket")} onLoad={() => markLoaded("basket")} src={`/assets/threshold/garden-basket.webp?v=${assetAttempts.basket ?? 0}`} alt="" />
      {hallMounted && ([0, 1, 2] as const).map(index => <Image key={`chairs-${index}-${assetAttempts.chairs ?? 0}`} width={1774} height={887} unoptimized loading="eager" className={`threshold-hall-chairs threshold-hall-chair-${index}`} onError={() => markFailed("chairs")} onLoad={() => markLoaded("chairs")} src={`/assets/threshold/hall-chairs.webp?v=${assetAttempts.chairs ?? 0}`} alt="" />)}
      <Image width={1774} height={887} unoptimized loading="eager" key={`plants-${assetAttempts.plants ?? 0}`} className="threshold-garden-plants" onError={() => markFailed("plants")} onLoad={() => markLoaded("plants")} src={`/assets/threshold/garden-plants.webp?v=${assetAttempts.plants ?? 0}`} alt="" />
      {hallMounted && <Image width={1774} height={887} unoptimized loading="eager" key={`flowers-${assetAttempts.flowers ?? 0}`} className="threshold-hall-flowers" onError={() => markFailed("flowers")} onLoad={() => markLoaded("flowers")} src={`/assets/threshold/hall-flowers.webp?v=${assetAttempts.flowers ?? 0}`} alt="" />}


      <div className="threshold-lamps" />
      <Image key={`foreground-${assetAttempts.foreground ?? 0}`} width={1774} height={887} unoptimized loading="eager" aria-hidden="true" className="threshold-foreground" onLoad={() => markLoaded("foreground")} onError={() => markFailed("foreground")} src={`/assets/threshold/courtyard-quiet-foreground-v1.webp?v=${assetAttempts.foreground ?? 0}`} alt="" />
      <div className="threshold-sunlight" />
      <div className="threshold-petals">{[0, 1, 2, 3, 4, 5, 6].map(index => <i key={index} />)}</div>
    </div>}
    {spatialChair && webglAllowed && nearby && tableMounted && <CourtyardSpatialChair />}
    <div className="threshold-shade" aria-hidden="true" />
    {!courtyardOnly && <div className="threshold-curtain" aria-hidden="true" />}
    {!courtyardOnly && <div className="threshold-portal" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onPointerLeave={finish} aria-hidden="true">
      <div className="threshold-frame"><div className="threshold-door threshold-door-left"/><div className="threshold-door threshold-door-right"/></div>
    </div>}
    <a className="threshold-skip" href="#how-neighborly-works" onClick={() => { actionCancel.current?.(); cancelChair(); document.getElementById("how-neighborly-works")?.focus({ preventScroll: true }); }}>Skip story</a>
    <header className="threshold-header"><span>{open ? "Small acts. Shared purpose." : "An open hand. An open door."}</span><Link href="/app">Enter Neighborly<ArrowUpRight size={15} aria-hidden="true" /></Link></header>
    <div className="threshold-invitation" aria-hidden={open}>
      <p className="neighborly-eyebrow">Make room for what comes next</p>
      <h2 id="threshold-title">There is room<br /><em>for you.</em></h2>
      <p>Bring a little of your time.<br />See what we can make together.</p>
    </div>
    <div className="threshold-open-action" hidden={baseFailed}><Button onClick={() => { cancel(); if (!open) alignStage(); if (open) { backToDoorway(); } else if (baseFailed) { setBaseFailed(false); setBaseReady(false); setBaseAttempt(value => value + 1); setOpenRequested(true); } else requestOpen(); }} className="threshold-open" aria-expanded={open} aria-label={open ? "Back to doorway" : baseFailed ? "Retry the courtyard" : openRequested ? "Opening the door" : "Open the door"}>{open ? <><span className="threshold-tool-label">Back to doorway</span><RotateCcw size={15} aria-hidden="true" /></> : <>{baseFailed ? "Retry the courtyard" : openRequested ? "Opening…" : "Open the door"}<ArrowRight size={18} aria-hidden="true" /></>}</Button>{!open && <span role="status">{baseFailed ? "The artwork could not load. Please try again." : openRequested ? "Preparing your welcome" : "Scroll to enter, or open the doors"}</span>}</div>
    {baseFailed && <div className="threshold-load-error" role="status"><p>The courtyard could not load.</p><Button variant="ghost" onClick={() => { setBaseFailed(false); setBaseReady(false); setBaseAttempt(value => value + 1); setOpenRequested(true); }}>Retry artwork<RotateCcw size={15} aria-hidden="true" /></Button><a href="#how-neighborly-works">Continue to Neighborly<ArrowRight size={15} aria-hidden="true" /></a></div>}
    {open && <div className="threshold-explore">
      {open && !active && !quiet && loaded[selected] && <Button ref={handleControl} variant="ghost" className={`threshold-chair-handle ${selected === 0 ? "threshold-basket-handle" : selected === 2 ? "threshold-flowers-handle" : ""}`} aria-label={selected === 0 ? "Bring the basket" : selected === 1 ? "Pull out a chair" : "Place the flowers"} disabled={acting} style={{ "--hand": chairProgress } as CSSProperties} onPointerDown={beginChair} onPointerMove={moveChair} onPointerUp={event => finishChair(event)} onPointerCancel={event => finishChair(event, true)} onLostPointerCapture={event => { if (event.buttons !== 0) cancelChair(); }} onClick={event => { if (event.detail === 0 || !chairDragged.current) toggleCare(event.detail === 0); }}><span>{selected === 0 ? "Bring the basket" : selected === 1 ? "Pull out a chair" : "Place the flowers"}</span><ArrowRight size={18} aria-hidden="true" /></Button>}
      <Button variant="ghost" className="threshold-light-control" aria-pressed={evening} onClick={() => setEvening(value => !value)}>{evening ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}<span className="threshold-tool-label">{evening ? "Evening light" : "Daylight"}</span></Button>
      <Button variant="ghost" className="threshold-quiet-control" aria-pressed={quiet} onClick={() => { if (overview) choose(2); else { setOverview(false); setQuiet(value => !value); } }}>{quiet ? "Show the story" : "Take in the view"}</Button>
      <div className="threshold-caption">{active && !acting && <p className="threshold-result" aria-hidden="true"><Check size={13} aria-hidden="true" />{["Something to share", "A place for one more", "Room to gather"][selected]}</p>}<div aria-live="polite" aria-atomic="true"><p className="neighborly-eyebrow">A little care, freely given</p><h3 aria-level={2}>{selected === 1 && invitationOutcome === "accepted" ? "Something to share." : selected === 1 && invitationOutcome === "declined" ? "Still a place for you." : courtyardOnly ? storyHeadings[selected] : destinations[selected]}</h3><p>{invitationOutcome === "accepted" && selected === 1 ? "Your neighbor is bringing the bread. There is room for what each person brings." : invitationOutcome === "declined" && selected === 1 ? "The bread is still unclaimed. There is still a place for your neighbor." : active && !acting ? resultCopy[selected] : courtyardOnly ? storyCopy[selected] : selected === 1 && care[0] ? "The harvest is here. Make a place for someone to share it." : offering.detail}</p>{active && !acting && <p className="sr-only">{["A basket is ready to share in the garden.", courtyardOnly ? "The table has another place, and the woman offers bread toward the open seat." : "The table has another place, and the woman preparing bread turns toward it.", courtyardOnly ? "Flowers and chairs are arranged inside the hall. The couple turns toward you, and the man offers an open hand of welcome." : "Flowers and chairs are arranged inside the hall. The two people turn toward the courtyard."][selected]}</p>}</div>{(active || !loaded[selected]) && <Button ref={resultControl} className="threshold-care-action" variant="ghost" aria-pressed={active} disabled={!loaded[selected] || acting} onClick={event => toggleCare(event.detail === 0)}>{assetFailed && !loaded[selected] ? "Scene unavailable" : !loaded[selected] ? "Preparing the scene…" : acting ? ["Tending…", "Making room…", "Preparing…"][selected] : active ? resetLabels[selected] : actionLabels[selected]}<ArrowRight size={16} aria-hidden="true" /></Button>}{selected === 1 && invitationOutcome !== "ready" ? null : active || invitationOutcome !== "ready" ? <Button className="threshold-invitation-action" variant="ghost" onClick={event => { invitationTrigger.current = event.currentTarget; setInvitationOpen(true); }}><span className="threshold-guide-mark" aria-hidden="true"><i /><b /><b /></span>{invitationOutcome === "accepted" ? "Bread · Your neighbor" : invitationOutcome === "declined" ? "The invitation stays open" : invitationOutcome === "pending" ? "An invitation is waiting" : "Make it a shared plan"}<ArrowRight size={17} aria-hidden="true" /></Button> : <Link href={`/app?intent=${offering.intent}`}>{offering.action}<ArrowUpRight size={17} aria-hidden="true" /></Link>}</div>
      {!continueIntoHall && care.every(Boolean) && !overview && <Button variant="ghost" className="threshold-overview" onClick={() => { motion.current?.showOverview(); setQuiet(true); setOverview(true); }}>See what we made together<ArrowRight size={16} aria-hidden="true" /></Button>}
      {!continueIntoHall && overview && <div className="threshold-shared-result"><p className="neighborly-eyebrow">{care.every(Boolean) ? "A garden tended. A place prepared. A welcome offered." : "A little of ourselves. A world of good."}</p><h3 aria-level={2}>Good work.<br /><em>Together.</em></h3><Link href="/app?intent=start">{courtyardOnly ? "Start a group" : "Bring this to your community"}<ArrowUpRight size={17} aria-hidden="true" /></Link>{courtyardOnly && <nav className="threshold-final-links" aria-label="Enter Neighborly"><Link href="/app?intent=join">Join your people<ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/app?intent=signin">Sign in<ArrowUpRight size={14} aria-hidden="true" /></Link></nav>}<Button variant="ghost" className="threshold-replay" onClick={replay}>Replay story<RotateCcw size={14} aria-hidden="true" /></Button></div>}
      {(assetFailed && !loaded[selected] || assetErrors.foreground || invitationOutcome === "accepted" && assetErrors.welcome) && <Button className="threshold-retry" variant="ghost" onClick={() => { retryArtwork(); }}>Retry artwork</Button>}
      <span className="threshold-look-hint" aria-hidden="true">{continueIntoHall && selected === 2 ? "Continue into the gathering" : "Scroll to continue"}</span>
      <nav className="threshold-destinations" aria-label="Explore ways to help">{destinations.map((name, index) => <Button key={name} variant="ghost" aria-pressed={selected === index} onClick={() => choose(index as Choice)}><span>0{index + 1}</span>{name}</Button>)}</nav>
    </div>}
    {open && selected === 1 && invitationOutcome !== "ready" && <Button className="threshold-table-note" variant="ghost" onClick={event => { invitationTrigger.current = event.currentTarget; setInvitationOpen(true); }}><span className="threshold-table-note-paper"><span className="threshold-guide-mark" aria-hidden="true"><i /><b /><b /></span><span><strong>Bread</strong><small>{invitationOutcome === "accepted" ? "Your neighbor" : invitationOutcome === "pending" ? "Awaiting a reply" : "Still open"}</small></span></span></Button>}
    {open && selected === 1 && invitationOutcome === "accepted" && !exploringAfterAnswer && <Button className="threshold-explore-after" variant="ghost" onClick={() => setExploringAfterAnswer(true)}>Explore the courtyard<ArrowRight size={15} aria-hidden="true" /></Button>}
    <PaperSurface open={invitationOpen} onOpenChange={value => { setInvitationOpen(value); if (!value && invitationOutcome !== "ready") { choose(1); if (invitationOutcome === "accepted") setExploringAfterAnswer(false); } }} title="A place at the table." variant="invitation" returnFocusRef={invitationTrigger}>
      <CareInvitation compact state={invitationOutcome} onOutcome={updateInvitationOutcome} />
    </PaperSurface>
  </section></div>;
}
