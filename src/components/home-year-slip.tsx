"use client";

import { type PointerEvent, useRef, useState } from "react";
import { sampleYear } from "@/lib/sample-year";

const whole = new Intl.NumberFormat("en-US");
const PAPER_EASE = "cubic-bezier(.2,.7,.2,1)";
/** How far a press may wander and still be a press, not a carry. */
const SLOP = 6;

/**
 * One request slip beside the year: the visitor picks it up and lays it on the pile of home visits (or presses it, from the keyboard
 * or by tap), and it is carried there whole, set down as one more sheet, and the visits figure turns over to count it.
 * On the page only; nothing is sent or kept. With Reduce Motion it is laid at once.
 */
export function HomeYearSlip() {
  const slip = useRef<HTMLButtonElement>(null);
  const carry = useRef<{ x: number; y: number; dx: number; dy: number; id: number } | null>(null);
  const carried = useRef(false);
  const [laid, setLaid] = useState(false);

  const visits = () => slip.current?.closest(".relief-words")?.querySelector<HTMLElement>(".home-year div:has([data-figure=visits])") ?? null;

  const lay = (dx = 0, dy = 0) => {
    const element = slip.current, cell = visits();
    if (!element || !cell || laid) return;
    const stack = cell.querySelector<HTMLElement>(".home-year-stack");
    const figure = cell.querySelector<HTMLElement>("[data-figure=visits]");
    const tab = cell.querySelector<HTMLElement>(".home-year-tab");
    const turn = () => {
      if (figure) figure.textContent = whole.format(sampleYear.visits + 1);
      cell.dataset.added = "true";
      setLaid(true);
      // The slip leaves with the press, so the keyboard is handed to what came of it.
      requestAnimationFrame(() => document.getElementById("home-year-give")?.focus({ preventScroll: true }));
    };
    if (!stack || matchMedia("(prefers-reduced-motion: reduce)").matches) return turn();
    // From where it is held to the top of the pile: carried whole and level, then it lies down onto the pile edge on, one sheet's depth.
    const from = element.getBoundingClientRect(), to = stack.getBoundingClientRect();
    const scale = (to.width - 8) / from.width;
    const x = to.left + 4 - from.left, y = to.bottom - 3 * Number(cell.dataset.sheets) - 3 - from.top;
    const set = element.animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${x}px, ${y - from.height * scale}px) scale(${scale})`, offset: .7 },
      { transform: `translate(${x}px, ${y}px) scale(${scale}, ${3 / from.height})` },
    ], { duration: 620, easing: PAPER_EASE, fill: "forwards" });
    // Its words are lifted off as it begins to lie down (a 0/1 step), so no line of type is ever seen squeezed.
    const lying = window.setTimeout(() => { element.dataset.lying = "true"; }, 620 * .7);
    void set.finished.then(() => {
      clearTimeout(lying);
      turn();
      // The figure's tab tips back off its hinge and stands again, the new count on it: never past 60° off upright.
      tab?.animate([{ transform: "none" }, { transform: "rotateX(60deg)", offset: .45 }, { transform: "none" }], { duration: 380, easing: PAPER_EASE });
    }, turn);
  };

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || laid) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    carried.current = false;
    carry.current = { x: event.clientX, y: event.clientY, dx: 0, dy: 0, id: event.pointerId };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const held = carry.current;
    if (!held || held.id !== event.pointerId) return;
    held.dx = event.clientX - held.x; held.dy = event.clientY - held.y;
    if (Math.hypot(held.dx, held.dy) < SLOP && !event.currentTarget.dataset.held) return;
    event.currentTarget.dataset.held = "true";
    event.currentTarget.style.transform = `translate(${held.dx}px, ${held.dy}px)`;
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const held = carry.current, element = event.currentTarget;
    carry.current = null;
    if (!held || !element.dataset.held) return;
    delete element.dataset.held;
    carried.current = true;
    element.style.removeProperty("transform");
    const box = visits()?.getBoundingClientRect();
    const over = box && event.clientX > box.left - 48 && event.clientX < box.right + 48 && event.clientY > box.top - 96 && event.clientY < box.bottom + 24;
    if (over) return lay(held.dx, held.dy);
    // Not over the pile: it goes back to where it was picked up from.
    element.animate([{ transform: `translate(${held.dx}px, ${held.dy}px)` }, { transform: "none" }], { duration: 280, easing: PAPER_EASE });
  };

  return <div className="home-year-give">
    <button ref={slip} type="button" className="home-year-slip" data-laid={laid || undefined} disabled={laid} aria-hidden={laid || undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClick={() => { if (!carried.current) lay(); }}
      aria-describedby="home-year-give">
      <strong>Rosa Fontaine</strong>
      <span>Rent, $450. Visited in pairs.</span>
    </button>
    <p id="home-year-give" role="status" tabIndex={-1}>{laid ? `${whole.format(sampleYear.visits + 1)} home visits. One of them yours.` : "Lay it on the visits pile."}</p>
  </div>;
}
