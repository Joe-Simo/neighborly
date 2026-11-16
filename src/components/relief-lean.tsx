"use client";

import { useEffect } from "react";
import "./relief-lean.css";

const DRIFT_ON_TOUCH = false;

/** The story's pictures lean with the pointer, by depth; on a touch screen they rest. Nothing runs while the story is off the screen, and nothing at all with Reduce Motion. */
export function ReliefLean() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>(".relief-story");
    if (!story || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.dataset.lean = "";
    const touch = matchMedia("(hover: none)").matches;
    // On a touch screen the pictures rest. The slow drift below is kept for the design lead to rule on.
    if (touch && !DRIFT_ON_TOUCH) return;
    const aim = { x: 0, y: 0 }, at = { x: 0, y: 0 }, set = { x: NaN, y: NaN };
    let raf = 0, last = 0, seen = false, seconds = 0;
    const tick = (time: number) => {
      raf = 0;
      const dt = Math.min(.05, last ? (time - last) / 1000 : .016); last = time; seconds += dt;
      if (touch) { aim.x = Math.sin(seconds * .33) * .45; aim.y = Math.cos(seconds * .26) * .3; }
      // The lean trails the pointer by about half a second.
      const trail = 1 - Math.exp(-dt * 2);
      at.x += (aim.x - at.x) * trail; at.y += (aim.y - at.y) * trail;
      // In fortieths, so styles are worked out again only when something would move a quarter of a pixel.
      const x = Math.round(at.x * 40) / 40, y = Math.round(at.y * 40) / 40;
      if (x !== set.x) story.style.setProperty("--lean-x", String(set.x = x));
      if (y !== set.y) story.style.setProperty("--lean-y", String(set.y = y));
      if (seen && (touch || Math.abs(aim.x - at.x) + Math.abs(aim.y - at.y) > .004)) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (seen && !raf) raf = requestAnimationFrame(tick); };
    const move = (event: PointerEvent) => { if (event.pointerType === "touch") return; aim.x = (event.clientX / innerWidth - .5) * 2; aim.y = (event.clientY / innerHeight - .5) * 2; wake(); };
    const leave = () => { aim.x = 0; aim.y = 0; wake(); };
    const watcher = new IntersectionObserver(entries => { seen = entries[entries.length - 1].isIntersecting; wake(); });
    watcher.observe(story);
    if (!touch) { addEventListener("pointermove", move, { passive: true }); document.documentElement.addEventListener("pointerleave", leave); }
    return () => { cancelAnimationFrame(raf); watcher.disconnect(); removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); delete document.documentElement.dataset.lean; story.style.removeProperty("--lean-x"); story.style.removeProperty("--lean-y"); };
  }, []);
  return null;
}
