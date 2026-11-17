"use client";

import { useLayoutEffect, useRef } from "react";

/** The longest the last room's sheet is held while the next one is still opening. */
const HOLD = 800;
const SLIDE = 200;
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** A copy of the room just left, taken as it stood, so it can lie on the page while the next room opens under it. */
let left: HTMLElement | undefined;

/**
 * Laid inside each room's sheet. When the room is left, its sheet is copied while it is still on the page, before
 * React takes it away.
 */
export function RoomLeaving() {
  const mark = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const room = mark.current?.parentElement;
    return () => {
      left = undefined;
      if (!room?.isConnected || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const copy = room.cloneNode(true) as HTMLElement;
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("inert", "");
      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      left = copy;
    };
  }, []);
  return <span ref={mark} hidden />;
}

/**
 * Between rooms the page never goes blank: the last room's sheet stays where it lay while the next opens beneath it,
 * and once the next has its rows (or after 800ms) the new sheet, opaque paper, slides up 8px over it in 200ms; the old one is taken away once it has landed.
 */
export function useSheetBetweenRooms(area: string) {
  useLayoutEffect(() => {
    const copy = left;
    left = undefined;
    const room = document.querySelector<HTMLElement>(".live-app .live-room");
    if (!copy || !room) return;
    const place = room.getBoundingClientRect();
    Object.assign(copy.style, {
      position: "fixed", left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px`,
      maxHeight: `${Math.max(0, window.innerHeight - place.top)}px`, overflow: "hidden", margin: "0",
      pointerEvents: "none", zIndex: "0", animation: "none",
    });
    room.style.animation = "none";
    room.style.visibility = "hidden";
    room.after(copy);
    const began = performance.now();
    let frame = 0;
    const ready = () => !!room.querySelector(":scope > :not([hidden])") && !room.querySelector(".live-loading, .help-opening");
    const hand = () => {
      if (!ready() && performance.now() - began < HOLD) return void (frame = requestAnimationFrame(hand));
      // The new sheet is opaque paper laid over the copy, which lies perfectly still until the sheet has landed.
      // Its rows are already whole on it (their own arrivals are for a room opened fresh), and the copy is cut to
      // the sheet's width, since the room's side column may have come in beside it meanwhile.
      room.getAnimations({ subtree: true }).forEach((move) => move.finish());
      copy.style.width = `${room.getBoundingClientRect().width}px`;
      Object.assign(room.style, { visibility: "", position: "relative", zIndex: "1", background: "var(--paper)" });
      const landed = () => {
        copy.remove();
        Object.assign(room.style, { position: "", zIndex: "", background: "" });
      };
      room.animate([{ transform: "translateY(8px)" }, { transform: "none" }], { duration: SLIDE, easing: EASE }).finished.then(landed, landed);
    };
    frame = requestAnimationFrame(hand);
    return () => {
      cancelAnimationFrame(frame);
      copy.remove();
      Object.assign(room.style, { visibility: "", position: "", zIndex: "", background: "" });
    };
  }, [area]);
}
