"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { HELD_CARD, dropTheHeldCard } from "@/lib/held-card";

const SAMPLE = "/app?intent=sample";
/** The card grows from the hand to the size of the window, and is held there until the door's sweep takes it over. */
const GROW = 520;
/** If nothing on the other side takes the card (an error, a visitor already inside), it is let go rather than held for ever. */
const LONGEST = 12000;

/** The open hand holds the card out: it is the way into the sample, and pressing it grows it into the first sheet of the room. */
export function CardOffer() {
  const router = useRouter();
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(HELD_CARD)) return;
    event.preventDefault();
    const offer = event.currentTarget, from = offer.getBoundingClientRect(), turn = Number(offer.dataset.turn ?? 0);
    // Drawn on the body, outside the page, so it stays over the window while the next page comes in under it.
    const held = document.createElement("div");
    held.id = HELD_CARD;
    held.setAttribute("aria-hidden", "true");
    held.innerHTML = "<div class=\"door-card\"><i></i><b></b><b></b></div>";
    document.body.append(held);
    const sheet = held.firstElementChild as HTMLElement, size = sheet.getBoundingClientRect();
    // The turned card's own width, found back from the rectangle around it.
    const slant = Math.abs(turn) * Math.PI / 180, width = (from.width * Math.cos(slant) - from.height * Math.sin(slant)) / Math.max(.2, Math.cos(2 * slant));
    const x = from.left + from.width / 2 - (size.left + size.width / 2), y = from.top + from.height / 2 - (size.top + size.height / 2);
    offer.dataset.given = "";
    const grow = sheet.animate([
      { transform: `translate(${x}px,${y}px) rotate(${turn}deg) scale(${width / size.width})`, borderRadius: `${8 * size.width / width}px` },
      { transform: "none", borderRadius: "40px" },
    ], { duration: GROW, easing: "cubic-bezier(.3,.6,.2,1)" });
    for (const mark of sheet.children) mark.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: .4 }], { duration: GROW, easing: "linear" });
    const since = performance.now();
    const keep = () => {
      if (!held.isConnected) return;
      // A visitor already inside goes straight to a room without the sweep: the card lifts off it once it is whole.
      if (performance.now() - since > LONGEST || document.querySelector(".live-app[data-room-whole]:not(:has([data-room-pending]))") && !document.querySelector(".door-sweep")) return dropTheHeldCard();
      requestAnimationFrame(keep);
    };
    grow.finished.then(() => { router.push(SAMPLE); requestAnimationFrame(keep); }, () => router.push(SAMPLE));
    // Back on the home page later, the card is in the hand again.
    setTimeout(() => delete offer.dataset.given, GROW + 400);
  }
  return <span className="neighborly-close-offer">
    <Link href={SAMPLE} className="card-offer" data-station="end" data-turn={-4} onClick={open}>
      <i aria-hidden="true" />
      <ArrowUpRight aria-hidden="true" />
      <span className="card-offer-words"><strong>Look around a sample conference</strong><small>Every person in the sample is made up.</small></span>
    </Link>
  </span>;
}
