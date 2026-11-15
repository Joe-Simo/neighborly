"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaintedWorld } from "./painted-world";
import { NeighborlyContinuation } from "./neighborly-continuation";
import { ExperienceSoundProvider } from "./experience-sound-context";

export function NeighborlyExperience() {
  const [passed, setPassed] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const cancel = () => clearTimeout(transitionTimer.current);
    const key = (event: KeyboardEvent) => { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Escape"].includes(event.key)) cancel(); };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", key);
    media.addEventListener("change", cancel);
    return () => { cancel(); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); window.removeEventListener("keydown", key); media.removeEventListener("change", cancel); };
  }, []);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const carry = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Entering the workspace is carried on one sheet of paper: it rises here and lifts away there.
    const element = root.current;
    if (!element) return;
    let release: ReturnType<typeof setTimeout> | undefined;
    let rise: Animation | undefined;
    const carryIn = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="/app"]');
      const sheet = carry.current;
      if (!link || link.target || !sheet || sheet.dataset.carrying === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      event.preventDefault();
      const href = link.getAttribute("href") ?? "/app";
      router.prefetch(href);
      try { sessionStorage.setItem("neighborly-paper", "1"); } catch { /* Without storage the workspace simply opens without the sheet. */ }
      sheet.dataset.carrying = "true";
      rise = sheet.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 620, easing: "cubic-bezier(.2,.65,.2,1)", fill: "forwards" });
      void rise.finished.then(() => {
        router.push(href);
        release = setTimeout(() => { delete sheet.dataset.carrying; rise?.cancel(); }, 6000);
      }, () => {});
    };
    element.addEventListener("click", carryIn, true);
    return () => { clearTimeout(release); rise?.cancel(); element.removeEventListener("click", carryIn, true); };
  }, [router]);
  useEffect(() => {
    // Sound belongs to the painted scenes. Once the visitor is reading the story, its control steps aside.
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const seen = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target);
      element.dataset.reading = String(seen.size > 0);
    }, { rootMargin: "0px 0px -45% 0px" });
    element.querySelectorAll(".relief-story,.neighborly-together").forEach(part => observer.observe(part));
    return () => observer.disconnect();
  }, []);
  // The doors stand one screen below the top of the journey, once the opening has given way.
  const goToDoors = () => {
    const doors = root.current?.querySelector<HTMLElement>(".fresco-journey");
    if (doors) window.scrollTo({ top: doors.getBoundingClientRect().top + scrollY + innerHeight * 1.02, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    element.classList.add("is-connected");
    let frame = 0;
    let entryRequested = false;
    const update = () => {
      frame = 0;
      const reduce = media.matches;
      const stage = element.querySelector<HTMLElement>(".painted-world-viewport");
      const progress = Math.max(0, Math.min(1, -element.getBoundingClientRect().top / Math.max(1, stage?.getBoundingClientRect().height ?? innerHeight)));
      element.style.setProperty("--entry-portrait", String(reduce ? Number(progress < .5) : 1 - Math.max(0, Math.min(1, (progress - .4) / .4))));
      element.style.setProperty("--entry-door", String(reduce ? Number(progress >= .5) : Math.max(0, Math.min(1, (progress - .3) / .5))));
      const portrait = element.querySelector<HTMLElement>(".painted-world-track");
      const courtyard = element.querySelector<HTMLElement>(".fresco-stage");
      const entered = progress >= (reduce ? .5 : .6);
      const portraitVisible = progress < (reduce ? .5 : .45);
      if (portrait && courtyard && entered && (entryRequested || portrait.contains(document.activeElement))) {
        courtyard.tabIndex = -1;
        courtyard.inert = false;
        courtyard.focus({ preventScroll: true });
        entryRequested = false;
      }
      if (portrait && courtyard && portraitVisible && courtyard.contains(document.activeElement)) {
        portrait.inert = false;
        portrait.setAttribute("aria-hidden", "false");
        portrait.querySelector<HTMLElement>(".painted-world-enter")?.focus({ preventScroll: true });
      }
      if (!portraitVisible && !entered && (portrait?.contains(document.activeElement) || courtyard?.contains(document.activeElement))) {
        entryRequested = true;
        element.querySelector<HTMLElement>(".painted-world")?.focus({ preventScroll: true });
      }
      if (portrait) { portrait.inert = !portraitVisible; portrait.setAttribute("aria-hidden", String(!portraitVisible)); }
      if (courtyard) { courtyard.inert = !entered; courtyard.setAttribute("aria-hidden", String(!entered)); }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    media.addEventListener("change", request);
    const enter = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href="#neighborly-courtyard"]')) return;
      entryRequested = true;
      request();
    };
    element.addEventListener("click", enter);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); media.removeEventListener("change", request); element.removeEventListener("click", enter); element.classList.remove("is-connected"); };
  }, []);
  return <div className="neighborly-connected-world" ref={root}><ExperienceSoundProvider><PaintedWorld heroOnly suspendOffscreen passed={passed} onContinue={goToDoors} onPass={() => {
    // The card crosses to the open hand, and then the journey begins by itself. Any scroll of the visitor's own takes over.
    setPassed(true);
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(goToDoors, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1500);
  }}><NeighborlyContinuation /></PaintedWorld></ExperienceSoundProvider><div ref={carry} className="neighborly-paper-carry" aria-hidden="true"><span>kind helps</span></div></div>;
}
