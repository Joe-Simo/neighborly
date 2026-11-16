"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { CardOffer } from "./card-offer";
import { HELD_CARD, dropTheHeldCard } from "@/lib/held-card";

/** The card grows from the hand until it is the window's paper, and is held there until the door's sweep takes it over. */
const GROW = 520;
/** If nothing on the other side takes the card (an error, a visitor already inside), it is let go rather than held for ever. */
const LONGEST = 12000;
const EASE = "cubic-bezier(.3,.6,.2,1)";
/** On a wide window the card starts slowly, so it is seen as the card, words and all, before it fills the window; a fast start covered the window in about 120ms. */
const WIDE = "cubic-bezier(.55,0,.25,1)";

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
    const timing = { duration: GROW, easing: EASE, fill: "forwards" } as const;
    const end = { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${cover})` };
    // On a narrow window the card first rises to the middle and straightens at the window's width, whole and readable, and only then fills it.
    const narrow = innerWidth < 701, rest = narrow ? .4 : 0;
    const grow = sheet.animate(narrow
      ? [{ transform: `rotate(${turn}deg)`, easing: EASE }, { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${innerWidth * .92 / width})`, offset: rest, easing: "cubic-bezier(.5,0,.3,1)" }, end]
      : [{ transform: `rotate(${turn}deg)` }, end], { ...timing, duration: narrow ? GROW + 200 : GROW, easing: narrow ? "linear" : WIDE });
    // Its words give way to the bare paper before any edge of them could leave the window.
    // On a narrow window the words go as soon as it starts to fill it, before any edge of them is cut.
    const fade = narrow ? rest : .42;
    for (const mark of sheet.children) mark.animate([{ opacity: 1 }, { opacity: 1, offset: fade }, { opacity: 0, offset: fade + (narrow ? .08 : .12) }, { opacity: 0 }], { ...timing, duration: narrow ? GROW + 200 : GROW, easing: "linear" });
    const since = performance.now();
    const keep = () => {
      if (!held.isConnected) return;
      // A visitor already inside goes straight to a room without the sweep: the card lifts off it once it is whole.
      const room = document.querySelector(".live-app[data-room-whole]") && !document.querySelector(".live-app [data-room-pending]") && !document.querySelector(".door-sweep");
      if (room || performance.now() - since > LONGEST) return dropTheHeldCard();
      requestAnimationFrame(keep);
    };
    const go = () => {
      router.push(href);
      requestAnimationFrame(keep);
      // A wait is quiet at first; if the room is not on its way after 400ms, the paper says so in one line, as the door does.
      window.setTimeout(() => {
        if (!held.isConnected || held.dataset.dropping !== undefined) return;
        const line = document.createElement("p");
        line.className = "card-held-opening";
        line.setAttribute("role", "status");
        line.textContent = "Opening…";
        held.append(line);
        held.dataset.saying = "";
      }, 400);
    };
    grow.finished.then(go, go);
  }
  return <CardOffer onOpen={open} />;
}
