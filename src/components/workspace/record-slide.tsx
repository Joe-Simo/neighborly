"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { turnBackOver } from "@/components/workspace/room-sheet";

const noChange = () => () => {};
/** True inside the iOS app (`:root[data-shell="ios"]`, set before the first paint). False on the server and the website. */
function useIosShell() {
  return useSyncExternalStore(noChange, () => document.documentElement.dataset.shell === "ios", () => false);
}

const KEPT = "kind-helps:list-place";

/** Resolves once the list or the record is in the page, or after a second, whichever is first. */
function drawn(part: "list" | "record") {
  // Whole: in the page, and the room no longer held back while it is drawn (the shell's "Opening…" wait).
  const whole = () => !!document.querySelector(`[data-record-slide="${part}"]`) && !document.querySelector("[data-room-held]");
  return new Promise<void>((done) => {
    if (whole()) return done();
    const watch = new MutationObserver(() => {
      if (!whole()) return;
      watch.disconnect();
      done();
    });
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-room-held"] });
    window.setTimeout(() => {
      watch.disconnect();
      done();
    }, 1000);
  });
}

/**
 * In the iOS app a record is a sheet of paper laid over its list. A tap on a row opens the record inside a view
 * transition: the list stays where it is and the record slides in from the right over it (shell-ios.css,
 * `kh-record`); its way back turns the record's page back, the list coming over from the left at the place it was
 * left (room-sheet.tsx, turnBackOver). A step back through the history (the system's edge swipe, which already moves
 * the page under the finger) is not animated again. Coming back, the list is at the place it was left. On the website nothing is
 * wrapped and nothing moves.
 */
export function RecordSlide({ part, children }: { part: "list" | "record"; children: ReactNode }) {
  const ios = useIosShell();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  // A tap on a row in the list opens its record over the list; the record's way back to the list slides it away.
  useEffect(() => {
    const here = box.current;
    if (!ios || !here || typeof document.startViewTransition !== "function") return;
    const ways = part === "list" ? "a[href*='neighbor=']" : "a[href='/app/neighbors']";
    const to = part === "list" ? "record" : "list";
    const go = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(ways) : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      const href = link.getAttribute("href") ?? "";
      if (to === "list") {
        // The way back turns the record's page back: the list comes back over from the left, at the place it was
        // left (only this way back gives the list its place again; the menu and other links open it at its top).
        const [place] = (sessionStorage.getItem(KEPT) ?? "").split(":");
        if (place) sessionStorage.setItem(KEPT, `${place}:back`);
        const column = here.closest<HTMLElement>("main.live-main") ?? here;
        void turnBackOver(column, async () => {
          router.push(href, { scroll: false });
          await drawn("list");
          // The list gives its place back as its rows come in: the page is turned once it stands there.
          await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
        });
        return;
      }
      const root = document.documentElement;
      // Marks the step's direction for shell-ios.css: the list is its own picture only while a record opens over it.
      root.dataset.recordStep = "open";
      const step = document.startViewTransition(async () => {
        router.push(href, { scroll: false });
        await drawn(to);
        // The record opens at its top; the list's own place is given back by the list itself.
        if (to === "record") window.scrollTo(0, 0);
      });
      void step.finished.finally(() => delete root.dataset.recordStep);
    };
    here.addEventListener("click", go, { capture: true });
    return () => here.removeEventListener("click", go, { capture: true });
  }, [ios, part, router]);

  // The list's place: read at the press, since opening a record moves the page to its top before the list is gone;
  // given back on a way back from that record once the rows are long enough to hold it.
  useLayoutEffect(() => {
    if (!ios) return;
    if (part === "record") return;
    const [place, from] = (sessionStorage.getItem(KEPT) ?? "").split(":");
    sessionStorage.removeItem(KEPT);
    let reach: ResizeObserver | undefined;
    if (from === "back") {
      const y = Number(place);
      const take = () => {
        if (document.documentElement.scrollHeight - window.innerHeight < y) return false;
        window.scrollTo(0, y);
        reach?.disconnect();
        return true;
      };
      if (!take()) {
        reach = new ResizeObserver(take);
        reach.observe(document.body);
        window.setTimeout(() => reach?.disconnect(), 1000);
      }
    }
    let at = window.scrollY;
    let pressed = false;
    const moved = () => {
      if (!pressed) at = window.scrollY;
    };
    const press = () => {
      at = window.scrollY;
      pressed = true;
    };
    window.addEventListener("scroll", moved, { passive: true });
    document.addEventListener("click", press, { capture: true });
    return () => {
      reach?.disconnect();
      window.removeEventListener("scroll", moved);
      document.removeEventListener("click", press, { capture: true });
      sessionStorage.setItem(KEPT, `${at}:list`);
    };
  }, [ios, part]);

  if (!ios) return <Fragment>{children}</Fragment>;
  return (
    // The frame leaves these links to this component (data-step-own): it takes the step and keeps the places.
    <div ref={box} data-record-slide={part} data-step-own="">
      {children}
    </div>
  );
}
