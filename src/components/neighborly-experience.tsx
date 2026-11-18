"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { paceOpening } from "@/lib/painted-world-scroll";
import { PaintedWorld } from "./painted-world";

/** A short, wide screen: the opening cannot be pinned there, so the page simply scrolls. Keep in step with the same query in painted-world.css. */
const sidewaysPhone = "(max-height:500px) and (min-aspect-ratio:10/11)";

// Everything below the opening is drawn by the server as before, but its script is a piece of its own: the opening
// comes alive first, and the doors, the story and the ending follow in a later turn instead of one long one.
const NeighborlyContinuation = dynamic(() => import("./neighborly-continuation").then(module => module.NeighborlyContinuation));

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
      // The sample card carries itself in: when it is pressed, it is the only paper that moves.
      if (!link || link.matches(".card-offer") || link.target || !sheet || sheet.dataset.carrying === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      event.preventDefault();
      const href = link.getAttribute("href") ?? "/app";
      router.prefetch(href);
      try { sessionStorage.setItem("neighborly-paper", "1"); } catch { /* Without storage the workspace simply opens without the sheet. */ }
      sheet.dataset.carrying = "true";
      rise = sheet.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.65,.2,1)", fill: "forwards" });
      void rise.finished.then(() => {
        router.push(href);
        release = setTimeout(() => { delete sheet.dataset.carrying; rise?.cancel(); }, 6000);
      }, () => {});
    };
    element.addEventListener("click", carryIn, true);
    return () => { clearTimeout(release); rise?.cancel(); element.removeEventListener("click", carryIn, true); };
  }, [router]);
  // The doors stand one screen below the top of the journey, once the opening has given way.
  const goToDoors = () => {
    const doors = root.current?.querySelector<HTMLElement>(".fresco-journey");
    if (doors) window.scrollTo({ top: doors.getBoundingClientRect().top + scrollY + innerHeight * (matchMedia(sidewaysPhone).matches ? 0 : 1.02), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sideways = matchMedia(sidewaysPhone);
    element.classList.add("is-connected");
    let frame = 0;
    let entryRequested = false;
    // Each value is written only on the few elements that draw with it, and only when it has changed: written on the whole page's root,
    // one changed value had every element of the page styled again on every frame of the scroll.
    const drawnBy: Record<string, string | null> = { "--entry-portrait": ".painted-world-viewport", "--entry-door": ".fresco-stage", "--entry-caption": ".painted-world-caption" };
    const written = new Map<string, string>();
    const write = (name: string, value: string) => {
      const selector = drawnBy[name];
      // A part drawn again by the page since the last write has lost its value, so the part itself is asked, not only the record.
      if (written.get(name) === value && (!selector || element.querySelector<HTMLElement>(selector)?.style.getPropertyValue(name) === value)) return;
      written.set(name, value);
      element.style.setProperty(name, value);
      if (selector) for (const part of element.querySelectorAll<HTMLElement>(selector)) part.style.setProperty(name, value);
    };
    const update = () => {
      frame = 0;
      const reduce = media.matches;
      // A phone on its side reads as a plain page: nothing is pinned, nothing gives way, and everything stays reachable.
      if (sideways.matches) {
        write("--entry-portrait", "1");
        write("--entry-door", "1");
        write("--entry-caption", "1");
        for (const part of element.querySelectorAll<HTMLElement>(".painted-world-track,.fresco-stage")) part.removeAttribute("data-away");
        return;
      }
      const stage = element.querySelector<HTMLElement>(".painted-world-viewport");
      const scrolled = Math.max(0, Math.min(1, -element.getBoundingClientRect().top / Math.max(1, stage?.getBoundingClientRect().height ?? innerHeight)));
      // The sheet begins to lift with the first pixel. With less motion nothing lifts, so the scroll is read as it is.
      const progress = reduce ? scrolled : paceOpening(scrolled);
      // The foot's "Scroll" has been answered once the page has moved: it leaves in one cut, before the edge reaches it.
      element.toggleAttribute("data-lifting", scrolled > .004);
      const portraitShown = reduce ? Number(progress < .5) : 1 - Math.max(0, Math.min(1, (progress - .4) / .4));
      write("--entry-portrait", String(portraitShown));
      // Once the sheet is wholly lifted its shadow is put away by an attribute, not only by the value: on iPad Safari a fling can leave
      // the fixed shadow painted where the value last stood, a dark band across every chapter after it.
      element.toggleAttribute("data-lifted", portraitShown <= 0);
      write("--entry-door", String(reduce ? Number(progress >= .5) : Math.max(0, Math.min(1, (scrolled - .3) / .5))));
      // The headline holds at full ink until the picture begins to leave at .4 and is gone by .5. The doors' own words are printed on the wall beneath and are simply uncovered.
      write("--entry-caption", String(reduce ? Number(progress < .5) : 1 - Math.max(0, Math.min(1, (progress - .4) / .1))));
      const portrait = element.querySelector<HTMLElement>(".painted-world-track");
      const courtyard = element.querySelector<HTMLElement>(".fresco-stage");
      const entered = progress >= (reduce ? .5 : .6);
      const portraitVisible = progress < (reduce ? .5 : .45);
      if (portrait && courtyard && entered && (entryRequested || portrait.contains(document.activeElement))) {
        courtyard.tabIndex = -1;
        courtyard.removeAttribute("data-away");
        courtyard.focus({ preventScroll: true });
        entryRequested = false;
      }
      if (portrait && courtyard && portraitVisible && courtyard.contains(document.activeElement)) {
        portrait.removeAttribute("data-away");
        portrait.querySelector<HTMLElement>(".painted-world-enter")?.focus({ preventScroll: true });
      }
      if (!portraitVisible && !entered && (portrait?.contains(document.activeElement) || courtyard?.contains(document.activeElement))) {
        entryRequested = true;
        element.querySelector<HTMLElement>(".painted-world")?.focus({ preventScroll: true });
      }
      // A part that has given way is only marked: it stays in what a screen reader is given, in its place in the order.
      portrait?.toggleAttribute("data-away", !portraitVisible);
      courtyard?.toggleAttribute("data-away", !entered);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    media.addEventListener("change", request);
    sideways.addEventListener("change", request);
    const enter = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href="#neighborly-courtyard"]')) return;
      entryRequested = true;
      request();
    };
    element.addEventListener("click", enter);
    // The keyboard walks the same way the eye does: Tab from the opening's last control goes on into the courtyard and its doors,
    // and Shift+Tab from the courtyard's first control comes back to the opening. Each is brought into view first, as scrolling would.
    const reachable = (part: HTMLElement) => [...part.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]")].filter(control => control.tabIndex >= 0 && !control.closest("[aria-hidden=true]"));
    const walk = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey || sideways.matches) return;
      const portrait = element.querySelector<HTMLElement>(".painted-world-track"), courtyard = element.querySelector<HTMLElement>(".fresco-stage"), stage = element.querySelector<HTMLElement>(".painted-world-viewport");
      if (!portrait || !courtyard || !stage) return;
      const at = document.activeElement, top = element.getBoundingClientRect().top + scrollY, height = stage.getBoundingClientRect().height;
      const go = (from: HTMLElement, to: HTMLElement, y: number, pick: (controls: HTMLElement[]) => HTMLElement | undefined) => {
        event.preventDefault();
        window.scrollTo({ top: y, behavior: "instant" });
        from.toggleAttribute("data-away", true);
        to.removeAttribute("data-away");
        // The place arrived at is drawn before its control is asked to take the keyboard: a control still hidden by the last place's drawing cannot.
        update();
        pick(reachable(to))?.focus({ preventScroll: true });
      };
      if (!event.shiftKey && courtyard.hasAttribute("data-away") && at === reachable(portrait).at(-1)) go(portrait, courtyard, top + height * (media.matches ? .5 : 1), controls => controls[0]);
      else if (event.shiftKey && portrait.hasAttribute("data-away") && at === reachable(courtyard)[0]) go(courtyard, portrait, top, controls => controls.at(-1));
    };
    element.addEventListener("keydown", walk);
    // A screen reader can move to a control in the part that has given way. The page is brought to that part first, as scrolling would, so what holds the keyboard is always what is shown.
    const follow = (event: FocusEvent) => {
      if (sideways.matches || !(event.target instanceof Element)) return;
      const part = event.target.closest<HTMLElement>(".painted-world-track[data-away], .fresco-stage[data-away]"), stage = element.querySelector<HTMLElement>(".painted-world-viewport");
      if (!part || !stage || part === event.target) return;
      const top = element.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: part.classList.contains("fresco-stage") ? top + stage.getBoundingClientRect().height * (media.matches ? .5 : 1) : top, behavior: "instant" });
      part.removeAttribute("data-away");
      update();
    };
    element.addEventListener("focusin", follow);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); media.removeEventListener("change", request); element.removeEventListener("click", enter); element.removeEventListener("keydown", walk); element.removeEventListener("focusin", follow); element.classList.remove("is-connected"); };
  }, []);
  return <div className="neighborly-connected-world is-connected" ref={root}><PaintedWorld heroOnly passed={passed} onContinue={goToDoors} onPass={() => {
    // The card crosses to the open hand and rests there a beat, long enough to see it settle and be held,
    // and then the journey begins by itself. Any scroll of the visitor's own takes over.
    setPassed(true);
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(goToDoors, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2100);
  }}><NeighborlyContinuation /></PaintedWorld><div ref={carry} className="neighborly-paper-carry" aria-hidden="true"><span>kind helps</span></div></div>;
}
