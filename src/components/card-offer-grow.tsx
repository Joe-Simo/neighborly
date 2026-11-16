"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { CardOffer } from "./card-offer";
import { HELD_CARD, dropTheHeldCard } from "@/lib/held-card";

/** The card grows from the hand until it is the window's paper, and is held there until the door's sweep takes it over. */
const GROW = 520;
/** If nothing on the other side takes the card (an error, a visitor already inside), it is let go rather than held for ever. */
const LONGEST = 12000;

/** Pressed, the card is not left behind: the same card, words and all, grows to the window and becomes the first sheet of the room. */
export function CardOfferGrow() {
  const router = useRouter();
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(HELD_CARD)) return;
    event.preventDefault();
    const offer = event.currentTarget, href = offer.getAttribute("href") ?? "/app";
    const turn = Number(offer.dataset.turn ?? 0), slant = Math.abs(turn) * Math.PI / 180, box = offer.getBoundingClientRect();
    // The turned card's own size, found back from the rectangle around it.
    const width = (box.width * Math.cos(slant) - box.height * Math.sin(slant)) / Math.max(.2, Math.cos(2 * slant)), height = width / 1.5;
    // Drawn on the body, outside the page, so it stays over the window while the next page comes in under it. It is the card itself, copied.
    const held = document.createElement("div");
    held.id = HELD_CARD;
    held.setAttribute("aria-hidden", "true");
    const sheet = offer.cloneNode(true) as HTMLElement;
    sheet.removeAttribute("href");
    sheet.removeAttribute("data-station");
    sheet.className = "card-offer card-held-sheet";
    Object.assign(sheet.style, { left: `${box.left + box.width / 2 - width / 2}px`, top: `${box.top + box.height / 2 - height / 2}px`, width: `${width}px` });
    held.append(sheet);
    document.body.append(held);
    // It grows about its middle to the window's middle, straightening, until no edge of it is in view.
    const cover = Math.max(innerWidth * 1.08 / width, innerHeight * 1.08 / height);
    const dx = innerWidth / 2 - (box.left + box.width / 2), dy = innerHeight / 2 - (box.top + box.height / 2);
    offer.dataset.given = "";
    const timing = { duration: GROW, easing: "cubic-bezier(.3,.6,.2,1)", fill: "forwards" } as const;
    const grow = sheet.animate([{ transform: `rotate(${turn}deg)` }, { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${cover})` }], timing);
    // Its words are read as it comes up, and give way to the bare paper as it fills the window.
    for (const mark of sheet.querySelectorAll(":scope > :not(.card-held-grain)")) mark.animate([{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0 }], timing);
    const since = performance.now();
    const keep = () => {
      if (!held.isConnected) return;
      // A visitor already inside goes straight to a room without the sweep: the card lifts off it once it is whole.
      const room = document.querySelector(".live-app[data-room-whole]") && !document.querySelector(".live-app [data-room-pending]") && !document.querySelector(".door-sweep");
      if (room || performance.now() - since > LONGEST) return dropTheHeldCard();
      requestAnimationFrame(keep);
    };
    const go = () => { router.push(href); requestAnimationFrame(keep); };
    grow.finished.then(go, go);
    // Back on the home page later, the card is in the hand again.
    setTimeout(() => delete offer.dataset.given, GROW + 600);
  }
  return <CardOffer onOpen={open} />;
}
