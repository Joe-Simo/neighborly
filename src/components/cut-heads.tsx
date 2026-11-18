"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const HEADS = ":is(.relief-words,.public-page,.neighborly-close,.painted-world,.home-yes) h2:not([tabindex])";

/**
 * Section heads as cut paper, by the rule of "Faith, lived out.": each public section head is cut from the page and hinged at its foot.
 * Below the fold it lies back at 60° (never further), and as it comes up the window it stands, whole, by the time its foot is
 * three quarters of the way up; it lies back again only as it goes back below. Its type is never split or redrawn: the head turns as one.
 * Only its transform changes, and only while one is in sight. With Reduce Motion, or without script, every head simply stands.
 */
export function CutHeads() {
  // Each page brings its own heads: looked for again on every page the visitor goes to.
  const path = usePathname();
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const heads = [...document.querySelectorAll<HTMLElement>(HEADS)];
    if (!heads.length) return;
    const seen = new Set<HTMLElement>();
    const set = new Map<HTMLElement, string>();
    let frame = 0;
    const place = () => {
      frame = 0;
      const h = innerHeight;
      seen.forEach(head => {
        const foot = head.getBoundingClientRect().bottom;
        const t = Math.max(0, Math.min(1, (h - foot) / (h * .25)));
        const stand = (1 - (1 - t) ** 3).toFixed(3);
        if (set.get(head) === stand) return;
        set.set(head, stand);
        head.style.setProperty("--stand", stand);
        head.dataset.cut = stand === "1.000" ? "stood" : "rising";
      });
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(place); };
    const watch = new IntersectionObserver(entries => {
      entries.forEach(entry => { const head = entry.target as HTMLElement; if (entry.isIntersecting) seen.add(head); else seen.delete(head); });
      wake();
    }, { rootMargin: "0px 0px 20% 0px" });
    heads.forEach(head => { head.dataset.cut = head.getBoundingClientRect().bottom < innerHeight * .75 ? "stood" : "rising"; watch.observe(head); });
    addEventListener("scroll", wake, { passive: true });
    addEventListener("resize", wake);
    return () => { heads.forEach(head => { delete head.dataset.cut; head.style.removeProperty("--stand"); }); watch.disconnect(); removeEventListener("scroll", wake); removeEventListener("resize", wake); cancelAnimationFrame(frame); };
  }, [path]);
  return null;
}
