"use client";

import { useEffect, useRef, useState } from "react";
import "@/components/made-courtyard.css";

/** The courtyard's sheets, back to front: the painting cut along its own depth map, and its people on a sheet of their own after the far cloister. */
const sheets = ["0", "1", "people", "2", "3", "4", "5"] as const;

/** How far apart the sheets are ever drawn: past this the floor sheet rides over the people at the table, so neither the hand nor the scroll goes further. */
const FARTHEST = .7;

const source = (sheet: (typeof sheets)[number], width: 960 | 1774) =>
  sheet === "people" ? `/assets/made/courtyard-people-${width}.webp` : `/assets/made/courtyard-sheet-${sheet}-${width}${sheet === "5" ? "" : "-filled"}.webp`;

/**
 * The courtyard drawn apart into its paper sheets, laid back together as the page scrolls past it.
 * `--open` is 1 apart and 0 whole; the scroll sets it in the same event, so the first scroll answers at once.
 * A reader can also take hold of it: dragged up or down, or moved with the arrow keys, the sheets follow the hand
 * one for one, and the scroll lets them be until the courtyard has left the screen.
 * Before the script arrives the courtyard lies whole and is only a picture. With Reduce Motion it lies whole in the page and the scroll
 * leaves it be, but it can still be held: each key or tenth of a drag is one cut.
 */
export function MadeCourtyard({ label, apart, whole, hold, hint, amount }: {
  label: string; apart: string; whole: string; hold: string; hint: string; amount: [whole: string, part: string, apart: string];
}) {
  const host = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const element = host.current, sheets = stack.current;
    if (!element || !sheets) return;
    // With Reduce Motion the scroll never moves the sheets, and the hand moves them only in whole tenths: each step is one cut.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = -1, start = 0, run = 1, held = false;
    // Where the courtyard's run begins and how long it is are measured once, and again only when the page's size changes,
    // so a scroll reads nothing from the layout and costs one style change.
    const measure = () => {
      const { top, height } = element.getBoundingClientRect();
      start = top + scrollY;
      run = Math.max(1, height - innerHeight);
    };
    const show = (value: number) => {
      const open = Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
      if (open === last) return;
      const whole = open === 0;
      if ((last === 0) !== whole || last < 0) element.dataset.whole = String(whole);
      last = open;
      element.style.setProperty("--open", String(Math.round(open * FARTHEST * 1000) / 1000));
      setPercent(Math.round(open * 100));
    };
    const place = () => {
      if (held || still) { if (last < 0) show(0); return; }
      // Apart for the first third of the run, laid together over the middle, whole for the last fifth.
      const travelled = Math.min(1, Math.max(0, ((scrollY - start) / run - .2) / .6));
      show(1 - travelled * travelled * (3 - 2 * travelled));
    };
    // The hand: a key moves the sheets a tenth at a time, and a drag moves them as far as the pointer goes, a third of the stack's height drawing them fully apart.
    const keyed = (event: KeyboardEvent) => {
      const step = { ArrowUp: .1, ArrowRight: .1, PageUp: .25, ArrowDown: -.1, ArrowLeft: -.1, PageDown: -.25 }[event.key];
      const to = event.key === "Home" ? 0 : event.key === "End" ? 1 : step === undefined ? undefined : Math.max(0, last) + step;
      if (to === undefined) return;
      event.preventDefault();
      held = true;
      show(to);
    };
    let from = 0, opened = 0;
    const pressed = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      held = true;
      from = event.clientY;
      opened = Math.max(0, last);
      sheets.setPointerCapture(event.pointerId);
      sheets.addEventListener("pointermove", moved);
    };
    const moved = (event: PointerEvent) => {
      const to = opened + (from - event.clientY) / Math.max(1, sheets.offsetHeight / 3);
      show(still ? Math.round(to * 10) / 10 : to);
    };
    const lifted = () => sheets.removeEventListener("pointermove", moved);
    const resized = () => { measure(); place(); };
    element.dataset.live = "true";
    // The sheets are shown together or not at all, so no sheet of the courtyard arrives after the others.
    Promise.all([...element.querySelectorAll("img")].map(image => image.decode().catch(() => undefined))).then(() => { element.dataset.ready = "true"; });
    // A window before the courtyard comes into sight its seven sheets are given their own layers, drawn once,
    // so the first scroll only moves them; they are let go again once it is far away.
    // Once the courtyard is far away, the scroll is given the sheets back.
    const near = new IntersectionObserver(([entry]) => {
      element.dataset.near = String(entry.isIntersecting);
      if (!entry.isIntersecting && held) { held = false; place(); }
    }, { rootMargin: "100% 0px" });
    near.observe(element);
    const sized = new ResizeObserver(resized);
    sized.observe(document.documentElement);
    resized();
    if (!still) addEventListener("scroll", place, { passive: true });
    sheets.addEventListener("keydown", keyed);
    sheets.addEventListener("pointerdown", pressed);
    sheets.addEventListener("pointerup", lifted);
    sheets.addEventListener("pointercancel", lifted);
    setLive(true);
    return () => {
      removeEventListener("scroll", place); sized.disconnect(); near.disconnect();
      sheets.removeEventListener("keydown", keyed); sheets.removeEventListener("pointerdown", pressed);
      sheets.removeEventListener("pointerup", lifted); sheets.removeEventListener("pointercancel", lifted); lifted();
    };
  }, []);

  return <div ref={host} className="made-courtyard" data-whole="true">
    <div className="made-courtyard-stage">
      {/* Once it can be held, the courtyard is a slider: how far apart its sheets are. Before that it is a picture. */}
      <div ref={stack} className="made-courtyard-stack" {...live
        ? { role: "slider", tabIndex: 0, "aria-label": hold, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-valuetext": percent === 0 ? amount[0] : percent === 100 ? amount[2] : amount[1].replace("{n}", String(percent)), "aria-orientation": "vertical" as const, "aria-describedby": "made-courtyard-hint" }
        : { role: "img", "aria-label": label }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the sheets are already cut at two widths and must stay in register, pixel for pixel */}
        {sheets.map((sheet, index) => <img
          key={sheet}
          src={source(sheet, 1774)}
          srcSet={`${source(sheet, 960)} 960w, ${source(sheet, 1774)} 1774w`}
          sizes="(max-width: 700px) 96vw, min(88vw, 1480px)"
          alt=""
          width={1774}
          height={887}
          loading="lazy"
          decoding="async"
          style={{ "--sheet": index } as React.CSSProperties}
        />)}
      </div>
      <p className="made-courtyard-said" aria-hidden="true"><span>{apart}</span><span>{whole}</span></p>
      {live && <p className="made-courtyard-hint" id="made-courtyard-hint">{hint}</p>}
    </div>
  </div>;
}
