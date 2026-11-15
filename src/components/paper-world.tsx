"use client";

import { useEffect, useRef } from "react";
import type { createPaperWorldController } from "@/lib/paper-world-controller";

export function PaperWorld({ selected, motion }: { selected: 0 | 1 | 2; motion: number }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createPaperWorldController> | null>(null);
  const selection = useRef(selected);
  useEffect(() => { if (motion > 0) controller.current?.pulse(); }, [motion]);
  useEffect(() => { selection.current = selected; controller.current?.setScene(selected); }, [selected]);
  useEffect(() => {
    const element = host.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    let disposed = false;
    let requested = false;
    let scrollFrame = 0;
    let touchOrigin: { x: number; y: number } | null = null;
    const position = () => {
      scrollFrame = 0;
      const bounds = parent.getBoundingClientRect();
      controller.current?.setProgress(Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - innerHeight))));
    };
    const requestPosition = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(position); };
    const load = () => {
      if (requested) return;
      requested = true;
      void import("@/lib/paper-world-controller").then(({ createPaperWorldController }) => {
        if (disposed) return;
        controller.current = createPaperWorldController(element, {
          onReady: () => { if (!disposed) element.dataset.ready = "true"; },
          onError: () => { if (!disposed) { controller.current?.dispose(); controller.current = null; element.dataset.ready = "false"; } },
        });
        controller.current.setScene(selection.current); position();
      }).catch(() => { element.dataset.ready = "false"; });
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { rootMargin: "50% 0px" });
    if (observer) observer.observe(element); else load();
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        if (!touchOrigin || Math.abs(event.clientX - touchOrigin.x) < Math.abs(event.clientY - touchOrigin.y) + 12) return;
      }
      const bounds = parent.getBoundingClientRect();
      controller.current?.setPointer(Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)), Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1)));
    };
    const begin = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("button,a,.care-touch-surface")) return;
      if (event.pointerType !== "mouse") touchOrigin = { x: event.clientX, y: event.clientY };
    };
    const leave = () => { touchOrigin = null; controller.current?.setPointer(0, 0); };
    parent.addEventListener("pointermove", move); parent.addEventListener("pointerleave", leave); parent.addEventListener("pointerdown", begin); parent.addEventListener("pointerup", leave); parent.addEventListener("pointercancel", leave);
    window.addEventListener("scroll", requestPosition, { passive: true });
    window.addEventListener("resize", requestPosition, { passive: true });
    return () => {
      disposed = true; cancelAnimationFrame(scrollFrame); observer?.disconnect(); controller.current?.dispose(); controller.current = null;
      parent.removeEventListener("pointermove", move); parent.removeEventListener("pointerleave", leave); parent.removeEventListener("pointerdown", begin); parent.removeEventListener("pointerup", leave); parent.removeEventListener("pointercancel", leave);
      window.removeEventListener("scroll", requestPosition); window.removeEventListener("resize", requestPosition);
    };
  }, []);
  return <div className="paper-world-backdrop" ref={host} aria-hidden="true" />;
}
