"use client";

import { useEffect } from "react";
import "./relief-lean.css";

/** The story's loose paper leans with the pointer while the pointer is over a chapter, and comes back to rest when it leaves. On a touch screen and with Reduce Motion the pictures rest. Nothing runs while the story is off the screen. */
export function ReliefLean({ within = ".relief-story" }: { within?: string }) {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>(within);
    if (!story || matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(hover: none)").matches) return;
    story.dataset.leans = "";
    document.documentElement.dataset.lean = "";
    const aim = { x: 0, y: 0 }, at = { x: 0, y: 0 }, set = { x: NaN, y: NaN };
    let raf = 0, last = 0, seen = false;
    const tick = (time: number) => {
      raf = 0;
      const dt = Math.min(.05, last ? (time - last) / 1000 : .016); last = time;
      // The lean trails the pointer by about 600ms, as the courtyard does.
      const trail = 1 - Math.exp(-dt / .6);
      at.x += (aim.x - at.x) * trail; at.y += (aim.y - at.y) * trail;
      // In fortieths, so styles are worked out again only when something would move a quarter of a pixel.
      const x = Math.round(at.x * 40) / 40, y = Math.round(at.y * 40) / 40;
      if (x !== set.x) story.style.setProperty("--lean-x", String(set.x = x));
      if (y !== set.y) story.style.setProperty("--lean-y", String(set.y = y));
      if (seen && Math.abs(aim.x - at.x) + Math.abs(aim.y - at.y) > .004) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (seen && !raf) raf = requestAnimationFrame(tick); };
    const rest = () => { aim.x = 0; aim.y = 0; wake(); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      aim.x = (event.clientX / innerWidth - .5) * 2; aim.y = (event.clientY / innerHeight - .5) * 2; wake();
    };
    const watcher = new IntersectionObserver(entries => { seen = entries[entries.length - 1].isIntersecting; wake(); });
    watcher.observe(story);
    story.addEventListener("pointermove", move, { passive: true });
    story.addEventListener("pointerleave", rest);
    return () => { cancelAnimationFrame(raf); watcher.disconnect(); story.removeEventListener("pointermove", move); story.removeEventListener("pointerleave", rest); delete story.dataset.leans; if (!document.querySelector("[data-leans]")) delete document.documentElement.dataset.lean; story.style.removeProperty("--lean-x"); story.style.removeProperty("--lean-y"); };
  }, [within]);
  return null;
}
