"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { restWhatIsUnderneath, wholeUnderneath } from "@/lib/room-whole";
import { placeTurn, setTurnGeometry, turnGeometry } from "@/lib/page-turn";
import "./courtyard-door.css";

/** Asked of the living courtyard on the window: it draws one frame and hands it back as a picture (living-courtyard.tsx). */
export const COURTYARD_STILL = "kh-courtyard-still";
export type CourtyardStill = { take: (picture: string, box: DOMRect) => void };

const HELD = "courtyard-held";
/** The page is turned off the room in this long. */
const TURN = 1100;
/** If nothing on the other side is ever whole, the courtyard is let go rather than held for ever. */
const LONGEST = 12000;
/** Where on home the visitor went in, so the way back stands them in the courtyard again (card-offer-grow.tsx reads it). */
const LEFT_AT = "home-left-at";

const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * The hall's open arch in the painting is a door into Kind Helps. Pressed, the courtyard is held over the window as the page it is,
 * the workspace (the sign-in sheet, the sample or a member's room, whichever this visitor gets) is laid whole beneath it,
 * and then the courtyard is turned off it from the lower right corner, as the story's pages are turned. Nothing is drawn over the arch.
 */
export function CourtyardDoor({ label, opening, here }: { label: string; opening: string; here: boolean }) {
  const router = useRouter();
  const enter = (event: MouseEvent<HTMLAnchorElement>) => goInTurning(event, router.push, opening);
  // Fetched before the press, so no cold first frame can land inside the turn.
  const ready = () => router.prefetch("/app");
  return <Link href="/app" className="fresco-door" aria-label={label} tabIndex={here ? undefined : -1} aria-hidden={here ? undefined : true} onClick={enter} onPointerEnter={ready} onFocus={ready} />;
}

/** Where the visitor stood on home when they went in, so Back returns them there (card-offer-grow.tsx restores it). */
export function keepPlace() {
  try { sessionStorage.setItem(LEFT_AT, String(Math.round(scrollY))); } catch {}
}

/** Pressed, a way in from the doors or the courtyard: the stage is held as one page, the workspace laid whole beneath it, and the page turned off. */
export function goInTurning(event: MouseEvent<HTMLAnchorElement>, push: (href: string) => void, opening: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || document.getElementById(HELD)) return;
  event.preventDefault();
  const href = event.currentTarget.getAttribute("href") ?? "/app";
  const stage = event.currentTarget.closest<HTMLElement>(".fresco-stage");
  keepPlace();
  if (!stage) return void push(href);
  const plain = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The held page, with the turn's parts around it (chapter-sheets.css draws them).
  const held = document.createElement("div");
  held.id = HELD;
  held.className = "relief-panel";
  held.dataset.turn = "from";
  held.setAttribute("aria-hidden", "true");
  held.innerHTML = `<div class="relief-turn" data-turned="no" data-near><div class="relief-turn-shade"></div><div class="relief-turn-round"><div class="relief-turn-page"><div class="courtyard-held-page"></div><div class="relief-turn-back"><div class="relief-turn-under"><div class="relief-turn-roll"></div></div></div></div></div></div>`;
  // The page is the stage itself, copied as it stands, with the living courtyard's canvas replaced by the frame it last drew.
  const sheet = held.querySelector<HTMLElement>(".courtyard-held-page")!;
  const copy = stage.cloneNode(true) as HTMLElement, box = stage.getBoundingClientRect();
  for (const named of [copy, ...copy.querySelectorAll<HTMLElement>("[id]")]) named.removeAttribute("id");
  Object.assign(copy.style, { position: "absolute", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0" });
  const canvas = copy.querySelector("canvas");
  window.dispatchEvent(new CustomEvent<CourtyardStill>(COURTYARD_STILL, { detail: { take: (picture) => {
    if (!canvas) return;
    const frame = document.createElement("img");
    frame.src = picture; frame.alt = ""; frame.className = canvas.className; frame.style.cssText = canvas.style.cssText;
    Object.assign(frame.style, { display: "block", width: "100%", height: "100%", maxWidth: "none" });
    canvas.replaceWith(frame);
  } } }));
  sheet.append(copy);
  // The sample's card, lying where it was on the doors or in the courtyard, is part of the page too: it is held with it, exactly as it lay.
  for (const card of document.querySelectorAll<HTMLElement>(".thread-card")) if (Number(getComputedStyle(card).opacity) > 0) sheet.append(card.cloneNode(true));
  document.body.append(held);
  // The page coming in may scroll where the courtyard did not: its scroll bar would stand beside the held page as a strip, so the window keeps none until the page is off.
  document.documentElement.toggleAttribute("data-courtyard-held", true);
  const turn = held.querySelector<HTMLElement>(".relief-turn")!;
  const part = (name: string) => held.querySelector<HTMLElement>(`.relief-turn-${name}`)!;
  const parts = { round: part("round"), page: part("page"), back: part("back"), roll: part("roll"), shade: part("shade") };
  const geometry = turnGeometry(innerWidth, innerHeight);
  setTurnGeometry(turn, geometry);

  push(href);

  const since = performance.now();
  let saying: HTMLElement | null = null, turning = 0;
  const off = () => { held.remove(); document.documentElement.removeAttribute("data-courtyard-held"); };
  const look = () => {
    if (!held.isConnected) return off();
    const waited = performance.now() - since;
    if (!wholeUnderneath() && waited < LONGEST) {
      // A wait is quiet at first; past 400ms the held page says so in one line.
      if (waited > 400 && !saying) {
        saying = document.createElement("p");
        saying.className = "courtyard-held-opening";
        saying.setAttribute("role", "status");
        saying.textContent = opening;
        held.append(saying);
      }
      return void requestAnimationFrame(look);
    }
    // The line goes first, in this frame, so it is never read over the room.
    saying?.remove();
    restWhatIsUnderneath();
    if (plain) return off();
    const step = (time: number) => {
      if (!turning) turning = time;
      const t = Math.min(1, (time - turning) / TURN);
      turn.dataset.turned = placeTurn(geometry, parts, easeInOut(t));
      if (t < 1) requestAnimationFrame(step); else off();
    };
    requestAnimationFrame(step);
  };
  requestAnimationFrame(look);
}
