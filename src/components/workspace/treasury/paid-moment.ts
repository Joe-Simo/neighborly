"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { arriving, holdThePage } from "@/components/workspace/fold";
import type { Payable } from "@/components/workspace/treasury/labels";

/** The request a payment was just recorded for, and the ledger entry that payment became. */
export type Paid = {
  request: Payable;
  amount: number;
  entryId: string;
  date: string;
  checkNumber?: string;
  /** True while the sheet is becoming its ledger line; the next request waits for it. */
  handing: boolean;
};

/** The whole hand-over: the sheet shortens in 360ms and is gone by 520ms. */
const HANDING = 560;
const LANDED = 1600;
const CLOSE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** The waiting sheet as it stood when its payment was sent: a copy to hand over, and where it was. */
let taken: { card: HTMLElement; from: DOMRect; paper: { backgroundColor: string; borderRadius: string; boxShadow: string } } | undefined;

function takeSheet() {
  taken = undefined;
  const sheet = document.querySelector<HTMLElement>(".treasury-sheet");
  if (!sheet || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = sheet.cloneNode(true) as HTMLElement;
  card.setAttribute("aria-hidden", "true");
  card.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  // Its words keep the sheet's measure and size until they fade: outside the room's column they would set anew.
  const originals = [...sheet.querySelectorAll<HTMLElement>("*")];
  card.querySelectorAll<HTMLElement>("*").forEach((part, index) => {
    const source = originals[index];
    if (!source) return;
    const look = getComputedStyle(source);
    Object.assign(part.style, { width: `${source.getBoundingClientRect().width}px`, fontSize: look.fontSize, lineHeight: look.lineHeight, boxSizing: "border-box" });
  });
  const look = getComputedStyle(sheet);
  taken = { card, from: sheet.getBoundingClientRect(), paper: { backgroundColor: look.backgroundColor, borderRadius: look.borderRadius, boxShadow: look.boxShadow } };
}

/**
 * The paid sheet becomes its ledger line, in its own place. Its top edge stays; it shortens to the line's height
 * on closeUp's curve, and the line beneath shortens with it, so its foot is always the page's next edge and it
 * never passes over a row. Its words fade within 100ms; the line's own come up as it lands, and its corner turns
 * further as it is taken. Call before the line is first painted. Nothing moves for anyone who asks for less motion.
 */
export function handOver(line: HTMLElement) {
  const now = taken;
  taken = undefined;
  if (!now) return;
  // The line's own opening is put aside, now and once the saved line has laid it: it does not open from nothing,
  // it takes the sheet's room.
  const unopened = () => line.getAnimations().forEach((move) => move.id === "paper-open-up" && move.cancel());
  line.getAnimations().forEach((move) => move.cancel());
  queueMicrotask(unopened);
  const place = line.getBoundingClientRect();
  if (place.bottom < 0 || place.top > window.innerHeight) return;
  const { card, from, paper } = now;
  const top = Math.min(from.top, place.top);
  const height = line.offsetHeight;
  const start = from.bottom - place.top;
  holdThePage();
  const box = { boxSizing: "border-box", overflow: "hidden" };
  line.animate([{ ...box, height: `${start}px` }, { ...box, height: `${height}px` }], { duration: 360, easing: CLOSE });
  // The line's words are set down whole, at full ink, once the card has closed over them: never faded in.
  line.querySelectorAll<HTMLElement>(":scope > *").forEach((part) =>
    part.animate([{ visibility: "hidden" }, { visibility: "hidden" }], { duration: 160 }),
  );
  // The amount waits for the turning corner to be gone from over it.
  line.querySelector(".treasury-paid-line strong")?.animate([{ visibility: "hidden" }, { visibility: "hidden" }], { duration: 290 });
  Object.assign(card.style, {
    position: "fixed", left: `${from.left}px`, top: `${top}px`, width: `${from.width}px`, height: `${from.bottom - top}px`,
    margin: "0", zIndex: "29", pointerEvents: "none", overflow: "hidden", boxSizing: "border-box", animation: "none",
  });
  // Taken, not waiting: its corner is the green one with the tick from its first frame, as the yes has it.
  card.classList.add("treasury-handed", "paper-fold");
  (line.closest(".live-app") ?? document.body).append(card);
  // The card's own words leave with its first frame, in one cut: they are never faded.
  [...card.children].forEach((part) => ((part as HTMLElement).style.visibility = "hidden"));
  const look = getComputedStyle(line);
  const done = () => card.remove();
  card.animate([{ height: `${from.bottom - top}px` }, { height: `${place.top + height - top}px` }], { duration: 360, easing: CLOSE, fill: "forwards" });
  card.animate(
    [
      { backgroundColor: paper.backgroundColor, borderRadius: paper.borderRadius, boxShadow: paper.boxShadow, opacity: 1 },
      { backgroundColor: look.backgroundColor, borderRadius: look.borderRadius, boxShadow: "0 0 0 #0000", opacity: 1, offset: 0.15 },
      { backgroundColor: look.backgroundColor, borderRadius: look.borderRadius, boxShadow: "0 0 0 #0000", opacity: 0, offset: 0.45 },
      { backgroundColor: look.backgroundColor, borderRadius: look.borderRadius, boxShadow: "0 0 0 #0000", opacity: 0 },
    ],
    { duration: 520, fill: "forwards" },
  ).finished.then(done, done);
  const corner = `${window.innerWidth < 700 ? 48 : 64}px`;
  card.animate([{ width: "38px", height: "38px", opacity: 1 }, { width: corner, height: corner, opacity: 1, offset: 0.23 }, { width: corner, height: corner, opacity: 0, offset: 0.45 }, { opacity: 0 }], {
    duration: 520, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards", pseudoElement: "::after",
  });
}

/**
 * A recorded payment: its sheet becomes its ledger line, which stays as the room's saved line. Once the hand-over
 * is done the next request rises below it, and the new ledger row holds a highlight for a moment.
 */
export function usePaidMoment() {
  const [paid, setPaid] = useState<Paid | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    if (!paid?.handing) return;
    const timer = setTimeout(
      () =>
        arriving(() =>
          flushSync(() => {
            setLanded(paid.entryId);
            setPaid((now) => now && { ...now, handing: false });
          }),
        ),
      HANDING,
    );
    return () => clearTimeout(timer);
  }, [paid]);
  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => setLanded(null), LANDED);
    return () => clearTimeout(timer);
  }, [landed]);
  return {
    paid,
    landed,
    pay: (request: Payable, amount: number, entryId: string, date: string, checkNumber?: string) => {
      takeSheet();
      setPaid({ request, amount, entryId, date, checkNumber, handing: true });
    },
  };
}
