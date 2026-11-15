"use client";

import { useEffect, useRef } from "react";

/** A single continuous ink line ties the paper sections together. */
export function CareThread({ selected }: { selected: 0 | 1 | 2 }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const selection = useRef<number>(selected);
  const wake = useRef<() => void>(() => {});
  useEffect(() => { selection.current = selected; wake.current(); }, [selected]);
  useEffect(() => {
    const element = canvas.current;
    const parent = element?.parentElement;
    const context = element?.getContext("2d");
    if (!element || !parent || !context) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, ratio = 1, frame = 0;
    let pointerX = .7, pointerY = -1000, targetX = .7, targetY = -1000;
    let choice = selection.current;
    const draw = () => {
      frame = 0;
      if (document.hidden) return;
      const reduce = media.matches;
      pointerX += (targetX - pointerX) * .14;
      pointerY += (targetY - pointerY) * .14;
      choice = reduce ? selection.current : choice + (selection.current - choice) * .12;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const bounds = parent.getBoundingClientRect();
      const front = reduce ? height : Math.max(0, Math.min(height, innerHeight * .77 - bounds.top));
      const position = (y: number, offset = 0) => {
        const t = y / height;
        const meander = Math.sin(t * Math.PI * 4.2 - .6 + choice * .12);
        const base = width * (.69 + meander * .21);
        const influence = reduce ? 0 : Math.exp(-Math.pow((y - pointerY) / 150, 2));
        return base + (pointerX * width - base) * influence * .24 + offset;
      };
      const stroke = (end: number, offset: number, color: string, weight: number) => {
        context.beginPath();
        context.moveTo(position(0, offset), 0);
        for (let y = 8; y < end; y += 8) context.lineTo(position(y, offset), y);
        context.lineTo(position(end, offset), end);
        context.strokeStyle = color; context.lineWidth = weight; context.stroke();
      };
      stroke(height, 0, "rgba(137, 110, 64, .11)", 1);
      stroke(front, 0, "rgba(154, 112, 48, .42)", 1.1);
      stroke(front, 2.5, "rgba(244, 225, 175, .55)", .65);
      if (front > 0 && front < height) {
        context.beginPath(); context.arc(position(front), front, 2.8, 0, Math.PI * 2);
        context.fillStyle = "#ae8a4d"; context.fill();
      }
      if (!reduce && (Math.abs(pointerX - targetX) > .001 || Math.abs(pointerY - targetY) > .5 || Math.abs(choice - selection.current) > .001)) frame = requestAnimationFrame(draw);
    };
    const request = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      width = Math.max(1, parent.clientWidth); height = Math.max(1, parent.clientHeight);
      ratio = Math.min(devicePixelRatio, 1.5, Math.sqrt(4_000_000 / (width * height)));
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      request();
    };
    const move = (event: PointerEvent) => {
      if (media.matches || event.pointerType !== "mouse") return;
      const bounds = parent.getBoundingClientRect();
      targetX = (event.clientX - bounds.left) / Math.max(1, width);
      targetY = event.clientY - bounds.top;
      request();
    };
    const leave = () => { targetY = -1000; request(); };
    const onScroll = () => { if (!media.matches) request(); };
    const observer = new ResizeObserver(resize); observer.observe(parent);
    wake.current = request;
    parent.addEventListener("pointermove", move);
    parent.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", onScroll, { passive: true });
    media.addEventListener("change", request);
    document.addEventListener("visibilitychange", request);
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); wake.current = () => {};
      parent.removeEventListener("pointermove", move); parent.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", onScroll); media.removeEventListener("change", request); document.removeEventListener("visibilitychange", request);
      element.width = 1; element.height = 1;
    };
  }, []);
  return <canvas className="care-thread" ref={canvas} aria-hidden="true" />;
}
