"use client";

import { type PointerEvent, useRef, useState } from "react";
import { laySlip, PAPER_EASE, tipTab } from "@/lib/lay-slip";
import { sampleYear } from "@/lib/sample-year";

const whole = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
/** How far a press may wander and still be a press, not a carry. */
const SLOP = 6;
/** Rosa's help, in dollars: the help figure waits for it. */
export const ROSA_HELP = 450;

/** Rosa's week, one slip a day, each laid on the figure it belongs to, which then reads the year's own pinned number. */
const week = [
  { figure: "calls", day: "Day one", line: "She calls about the rent.", ask: "Add her call to the count.", done: `${whole.format(sampleYear.calls)} calls.` },
  { figure: "visits", day: "Day three", line: "Visited in pairs.", ask: "Add the visit to the count.", done: `${whole.format(sampleYear.visits)} home visits.` },
  { figure: "paid", day: "Day four", line: "$450 toward rent, paid to the landlord.", ask: "Add the $450 to what was paid.", done: `${dollars.format(sampleYear.helpPaid / 100)} in help.` },
] as const;
const finals = { calls: whole.format(sampleYear.calls), visits: whole.format(sampleYear.visits), paid: dollars.format(sampleYear.helpPaid / 100) };

/**
 * One neighbour's week beside the year: three slips, laid one after another (picked up and carried, or pressed from the keyboard or by tap),
 * each carried whole onto its figure, and the figure turns over to the year's own count.
 * On the page only; nothing is sent or kept. With Reduce Motion each is laid at once.
 */
export function HomeYearSlip() {
  const slip = useRef<HTMLButtonElement>(null);
  const carry = useRef<{ x: number; y: number; dx: number; dy: number; id: number } | null>(null);
  const carried = useRef(false);
  const busy = useRef(false);
  const [step, setStep] = useState(0);
  const today = week[Math.min(step, week.length - 1)];
  const laid = step >= week.length;

  const cell = () => slip.current?.closest(".relief-words")?.querySelector<HTMLElement>(`.home-year div:has([data-figure=${today.figure}])`) ?? null;

  const lay = (dx = 0, dy = 0) => {
    const element = slip.current, target = cell();
    if (!element || !target || laid || busy.current) return;
    busy.current = true;
    const figure = target.querySelector<HTMLElement>(`[data-figure=${today.figure}]`);
    const tab = target.querySelector<HTMLElement>(".home-year-tab");
    const turn = () => {
      if (figure) figure.textContent = finals[today.figure];
      delete element.dataset.lying;
      element.getAnimations().forEach(animation => animation.cancel());
      busy.current = false;
      const next = step + 1;
      setStep(next);
      // The slip leaves with the press: the keyboard stays on the next day's slip, and after the last, goes to what came of it.
      requestAnimationFrame(() => (next < week.length ? element : document.getElementById("home-year-give"))?.focus({ preventScroll: true }));
    };
    // The piles are not drawn: the slip lands on its figure, which then turns over.
    const onto = tab;
    if (!onto || matchMedia("(prefers-reduced-motion: reduce)").matches) return turn();
    const to = onto.getBoundingClientRect();
    void laySlip(element, to, to.bottom, { dx, dy }).finished.then(() => { turn(); tipTab(tab); }, turn);
  };

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || laid || busy.current) return;
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
    const box = cell()?.getBoundingClientRect();
    const over = box && event.clientX > box.left - 48 && event.clientX < box.right + 48 && event.clientY > box.top - 96 && event.clientY < box.bottom + 24;
    if (over) return lay(held.dx, held.dy);
    // Not over its pile: it goes back to where it was picked up from.
    element.animate([{ transform: `translate(${held.dx}px, ${held.dy}px)` }, { transform: "none" }], { duration: 280, easing: PAPER_EASE });
  };

  const said = laid ? `${week.map(day => day.done).join(" ")} Rosa's week is in the year.` : step ? `${week[step - 1].done} ${today.ask}` : today.ask;
  return <div className="home-year-give">
    <button ref={slip} type="button" className="home-year-slip" data-laid={laid || undefined} disabled={laid} aria-hidden={laid || undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClick={() => { if (!carried.current) lay(); carried.current = false; }}
      aria-describedby="home-year-give">
      <strong>Rosa Fontaine</strong>
      <span>{today.day}. {today.line}</span>
    </button>
    <p id="home-year-give" role="status" tabIndex={-1}>{said}</p>
  </div>;
}
