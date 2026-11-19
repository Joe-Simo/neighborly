"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { whenIdle } from "@/lib/idle";

/**
 * Section heads as cut paper, by the rule of "Faith, lived out.": each public section head is cut from the page and hinged at its foot.
 * Below the fold it lies back at 60° (never further), and it stands, whole, while its foot crosses the bottom fifth of the window:
 * once a visit, never lying back again. Its foot shade and cut line lie flat on the page under it, cast along the one sun. Its type is never split or redrawn: the head turns as one.
 * Only its transform changes, and only while one is in sight. With Reduce Motion, or without script, every head simply stands.
 *
 * Each head is a <CutHead>, which joins the one shared watch from its own effect, so it is only ever touched after React has hydrated it:
 * the server's markup (a standing head, no data-cut) and the first client render always agree. data-cut and --stand are never rendered by React.
 */
const seen = new Set<HTMLElement>();
const met = new Set<HTMLElement>();
const set = new Map<HTMLElement, string>();
let watch: IntersectionObserver | null = null;
let frame = 0;

const place = () => {
  frame = 0;
  const h = innerHeight;
  seen.forEach(head => {
    // It moves only while its foot is in the bottom fifth of the window; above that it stands, and once stood it stays stood for the visit.
    const t = Math.max(0, Math.min(1, (h - head.getBoundingClientRect().bottom) / (h * .2)));
    const stand = (1 - (1 - t) ** 3).toFixed(3);
    if (set.get(head) === stand) return;
    set.set(head, stand);
    if (stand === "1.000") { head.dataset.cut = "stood"; head.style.removeProperty("--stand"); seen.delete(head); watch?.unobserve(head); return; }
    head.style.setProperty("--stand", stand);
  });
};
const wake = () => { if (!frame) frame = requestAnimationFrame(place); };

// Heads mount one by one as their sections hydrate. They are gathered and given to the watch together once the page is idle,
// so hydration is never cut by an observer's first answer and the layout it reads, once per section. A head below the fold
// is waiting to be scrolled to anyway; one already in the bottom fifth starts its stand a moment later, from where it lies.
const waiting = new Set<HTMLElement>();
let gathering: (() => void) | undefined;
let still: boolean | undefined;
const reduced = () => still ??= matchMedia("(prefers-reduced-motion: reduce)").matches;

function gather() {
  gathering = undefined;
  waiting.forEach(observe);
  waiting.clear();
}

function join(head: HTMLElement) {
  waiting.add(head);
  gathering ??= whenIdle(gather, 600, 120);
}

function observe(head: HTMLElement) {
  if (!watch) {
    // Where each head lies is learnt from the observer's own first answer, never by measuring the page as it lands (a page turned to is laid out inside the turn).
    watch = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const head = entry.target as HTMLElement;
        if (!met.has(head)) {
          met.add(head);
          if (entry.boundingClientRect.bottom < innerHeight * .8) { head.dataset.cut = "stood"; watch?.unobserve(head); return; }
          head.dataset.cut = "rising";
        }
        if (entry.isIntersecting) seen.add(head); else seen.delete(head);
      });
      wake();
    }, { rootMargin: "0px 0px 20% 0px" });
    addEventListener("scroll", wake, { passive: true });
    addEventListener("resize", wake);
  }
  watch.observe(head);
}

function leave(head: HTMLElement) {
  if (waiting.delete(head) && !waiting.size && gathering) { gathering(); gathering = undefined; }
  watch?.unobserve(head);
  seen.delete(head); met.delete(head); set.delete(head);
  delete head.dataset.cut; head.style.removeProperty("--stand");
  if (met.size || !watch) return;
  watch.disconnect(); watch = null;
  removeEventListener("scroll", wake); removeEventListener("resize", wake);
  cancelAnimationFrame(frame); frame = 0;
}

/** A public section head, cut from the page: an h2 that stands up from 60° as it comes into the window. */
export function CutHead(props: ComponentPropsWithoutRef<"h2">) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const head = ref.current;
    if (!head || reduced()) return;
    join(head);
    return () => leave(head);
  }, []);
  return <h2 {...props} ref={ref} />;
}
