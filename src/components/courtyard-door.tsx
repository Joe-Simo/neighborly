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
  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || document.getElementById(HELD)) return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href") ?? "/app";
    const stage = event.currentTarget.closest<HTMLElement>(".fresco-stage");
    if (!stage) return void router.push(href);
    try { sessionStorage.setItem(LEFT_AT, String(Math.round(scrollY))); } catch {}
    const plain = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The page as it is: the painting, the living courtyard's last frame over it, and the words on the paving, each where it lies on the window.
    const held = document.createElement("div");
    held.id = HELD;
    held.className = "relief-panel";
    held.dataset.turn = "from";
    held.setAttribute("aria-hidden", "true");
    held.innerHTML = `<div class="relief-turn" data-turned="no" data-near><div class="relief-turn-shade"></div><div class="relief-turn-round"><div class="relief-turn-page"><div class="courtyard-held-page"></div><div class="relief-turn-back"><div class="relief-turn-under"><div class="relief-turn-roll"></div></div></div></div></div></div>`;
    const sheet = held.querySelector<HTMLElement>(".courtyard-held-page")!;
    const lay = (node: HTMLElement, box: DOMRect) => {
      Object.assign(node.style, { position: "absolute", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0", maxWidth: "none", maxHeight: "none", translate: "none", transform: "none" });
      sheet.append(node);
    };
    const painting = stage.querySelector<HTMLImageElement>(".fresco-painting");
    if (painting) lay(painting.cloneNode() as HTMLElement, painting.getBoundingClientRect());
    window.dispatchEvent(new CustomEvent<CourtyardStill>(COURTYARD_STILL, { detail: { take: (picture, box) => {
      const frame = document.createElement("img");
      frame.src = picture; frame.alt = "";
      lay(frame, box);
    } } }));
    const words = stage.querySelector<HTMLElement>(".fresco-standing");
    if (words) {
      const box = words.getBoundingClientRect(), copy = words.cloneNode(true) as HTMLElement;
      copy.style.opacity = getComputedStyle(words).opacity;
      lay(copy, box);
      copy.style.transform = "none";
      const leaning = words.firstElementChild;
      if (leaning instanceof HTMLElement && copy.firstElementChild instanceof HTMLElement) copy.firstElementChild.style.transform = getComputedStyle(leaning).transform;
    }
    document.body.append(held);
    const turn = held.querySelector<HTMLElement>(".relief-turn")!;
    const part = (name: string) => held.querySelector<HTMLElement>(`.relief-turn-${name}`)!;
    const parts = { round: part("round"), page: part("page"), back: part("back"), roll: part("roll"), shade: part("shade") };
    const geometry = turnGeometry(innerWidth, innerHeight);
    setTurnGeometry(turn, geometry);

    router.push(href);

    const since = performance.now();
    let saying: HTMLElement | null = null, turning = 0;
    const off = () => held.remove();
    const look = () => {
      if (!held.isConnected) return;
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
  };
  return <Link href="/app" className="fresco-door" aria-label={label} tabIndex={here ? undefined : -1} aria-hidden={here ? undefined : true} onClick={enter} />;
}
