"use client";

import { useRouter } from "next/navigation";
import { useEffect, type MouseEvent } from "react";
import { CardOffer } from "./card-offer";
import type { CardWords } from "./public-ending";
import { useSampleDoor } from "./sample-link";
import { HELD_CARD, dropTheHeldCard } from "@/lib/held-card";
import { ROOM_WHOLE } from "@/lib/room-whole";

/** The card grows from the hand until it is the window's paper, and is held there until the door's sweep takes it over. */
const GROW = 520;
/** If nothing on the other side takes the card (an error, a visitor already inside), it is let go rather than held for ever. */
const LONGEST = 12000;
const EASE = "cubic-bezier(.3,.6,.2,1)";
/** On a wide window the card starts slowly, so it is seen as the card, words and all, before it fills the window; a fast start covered the window in about 120ms. */
const WIDE = "cubic-bezier(.55,0,.25,1)";
/** The gold square's travel on a wide window: it stays on the card while the card is still a card, and is at rest this far past the paper's cut. */
const TRAVEL = "cubic-bezier(.65,0,.6,1)", SETTLE = .12;

/** Pressed, the card is not left behind: the same card, words and all, grows to the window and becomes the first sheet of the room. */
export function CardOfferGrow({ said }: { said: CardWords }) {
  const router = useRouter();
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(HELD_CARD)) return;
    event.preventDefault();
    const offer = event.currentTarget, href = offer.getAttribute("href") ?? "/app";
    // The grow starts from the card as it lies, not as it leans: without the mark it lies flat at once, with no easing back.
    offer.removeAttribute("data-leaning");
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
    const fill = Math.max(innerWidth * 1.08 / width, innerHeight * 1.08 / height);
    const dx = innerWidth / 2 - (box.left + box.width / 2), dy = innerHeight / 2 - (box.top + box.height / 2);
    offer.dataset.given = "";
    const timing = { duration: GROW, easing: EASE, fill: "forwards" } as const;
    const end = { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${fill})` };
    // On a narrow window the card first rises to the middle and straightens at the window's width, whole and readable, and only then fills it.
    const narrow = innerWidth < 701, rest = narrow ? .4 : 0;
    const grow = sheet.animate(narrow
      ? [{ transform: `rotate(${turn}deg)`, easing: EASE }, { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${innerWidth * .92 / width})`, offset: rest, easing: "cubic-bezier(.5,0,.3,1)" }, end]
      : [{ transform: `rotate(${turn}deg)` }, end], { ...timing, duration: narrow ? GROW + 200 : GROW, easing: narrow ? "linear" : WIDE });
    // Its words give way to the bare paper before any edge of them could leave the window.
    // On a narrow window the words go just after it starts to fill it, once its paper is under where the grown card letters the name, before any edge of them is cut.
    const fade = narrow ? rest + .1 : .42;
    // A clean swap in one frame: the card's own words, square and name go as the grown card's marks and name come, so the two are never seen together.
    const swap = (from: number, to: number) => [{ opacity: from }, { opacity: from, offset: fade }, { opacity: to, offset: Math.min(1, fade + .001) }, { opacity: to }];
    // The card's own square is not among them: the gold square is one square from the first frame to the last (below).
    const own = sheet.querySelector<HTMLElement>(":scope > i");
    for (const mark of sheet.children) if (mark !== own) mark.animate(swap(1, 0), { ...timing, duration: narrow ? GROW + 200 : GROW, easing: "linear" });
    // As the words give way, the grown card's own marks come up in the same moment, where the door's card has them: the card is never blank paper.
    const marks = document.createElement("div");
    marks.className = "card-held-marks";
    const square = document.createElement("i");
    marks.append(square);
    // The name written on the card is lettered on the grown paper too, where the door's card will be, so it is still the visitor's card.
    const written = offer.querySelector(".card-offer-for span")?.textContent?.trim();
    // On the card the name is lettered on its paper, so it grows with the card and keeps its place over the square; the grown card letters it again over its own square, as the door does.
    const line = written ? document.createElement("em") : null;
    if (line) { line.textContent = `For ${written}`; marks.append(line); }
    // Under the marks, from the same frame, the paper they sit on is the door's fixed paper: the grain stops growing with the card.
    const paper = document.createElement("div");
    paper.className = "card-held-paper";
    held.append(paper, marks);
    const span = narrow ? GROW + 200 : GROW;
    const cover = paper.animate(swap(0, 1), { ...timing, duration: span, easing: "linear" });
    line?.animate(swap(0, 1), { ...timing, duration: narrow ? GROW + 200 : GROW, easing: "linear" });
    // One gold square all the way: it leaves from the card's own square, turned as the card is turned, and comes to rest as the
    // grown paper's square, so the card's last grown frame and the paper are the same mark in the same place. Nothing is swapped.
    if (own) {
      const from = own.getBoundingClientRect(), to = square.getBoundingClientRect(), side = width * own.offsetWidth / Math.max(1, sheet.offsetWidth);
      own.style.opacity = "0";
      const pose = (x: number, y: number, size: number, angle: number) => `translate(${x - (to.left + to.width / 2)}px,${y - (to.top + to.height / 2)}px) rotate(${angle}deg) scale(${size / to.width})`;
      const start = { transform: pose(from.left + from.width / 2, from.top + from.height / 2, side, turn), opacity: 1 }, last = { transform: pose(to.left + to.width / 2, to.top + to.height / 2, to.width, 0), opacity: .4 };
      // On a narrow window it stays in its place on the card while the card rises whole, and travels only as the card fills the window.
      const whole = innerWidth * .92 / width, risen = { transform: pose(innerWidth / 2 + (own.offsetLeft + own.offsetWidth / 2 - sheet.offsetWidth / 2) * width / sheet.offsetWidth * whole, innerHeight / 2 + (own.offsetTop + own.offsetHeight / 2 - sheet.offsetHeight / 2) * width / sheet.offsetWidth * whole, side * whole, 0), opacity: 1 };
      // Nothing moves on still paper. On a narrow window the square is in its place and at the paper's tone in the frame the paper
      // covers the card. On a wide one its place is still outside the card then, so it arrives just as the card's edge has passed it.
      const landed = narrow ? fade : fade + SETTLE;
      square.animate(narrow
        ? [{ ...start, easing: EASE }, { ...risen, offset: rest, easing: "ease-in-out" }, { ...last, offset: landed }, last]
        : [{ ...start, easing: TRAVEL }, { ...last, offset: landed }, last], { ...timing, duration: span, easing: "linear" });
    }
    // The room is asked for in the first frame the paper covers the window, not at the grow's end: it is laid and drawn whole under the
    // paper while the card goes on growing, and it is never seen round a half-grown card.
    const covered = (fade + .001) * span;
    const ask = () => {
      if (!held.isConnected) return;
      if (Number(cover.currentTime ?? 0) < covered && cover.playState !== "finished") return void requestAnimationFrame(ask);
      router.push(href);
    };
    requestAnimationFrame(ask);
    // A visitor already inside goes straight to a room without the sweep: the card lifts off it on "grown and the room whole", in the
    // frame the room says it is whole (ROOM_WHOLE, sent before that frame is painted). No fixed hold. The door's sweep takes the card itself.
    const whole = () => !!document.querySelector(".live-app[data-room-shown]") && !document.querySelector(".live-app [data-room-pending]") && !document.querySelector(".door-sweep");
    const grown = () => {
      if (!held.isConnected) return;
      const leave = () => {
        if (held.isConnected && !whole()) return;
        window.removeEventListener(ROOM_WHOLE, leave);
        clearTimeout(longest);
        clearTimeout(saying);
        dropTheHeldCard();
      };
      // If nothing on the other side ever takes the card, it is let go rather than held for ever.
      const longest = window.setTimeout(() => { window.removeEventListener(ROOM_WHOLE, leave); dropTheHeldCard(); }, LONGEST);
      // A wait is quiet at first; if the room is not on its way after 400ms, the paper says so in one line, as the door does.
      const saying = window.setTimeout(() => {
        if (!held.isConnected || held.dataset.dropping !== undefined) return;
        const line = document.createElement("p");
        line.className = "card-held-opening";
        line.setAttribute("role", "status");
        line.textContent = "Opening…";
        held.append(line);
        held.dataset.saying = "";
      }, 400);
      // The mark is read once as the listening starts, since the room may be whole already and says so only once.
      window.addEventListener(ROOM_WHOLE, leave);
      // The mark is also read each frame: a room that was still waiting on a reading when it said so clears it later, and says nothing more.
      const keep = () => { leave(); if (held.isConnected && held.dataset.dropping === undefined) requestAnimationFrame(keep); };
      keep();
    };
    grow.finished.then(grown, grown);
  }
  useCardLean();
  return <CardOffer said={said} door={useSampleDoor(open)} />;
}

/** At rest the card turns a little toward a mouse or pen, at most 1.5 degrees, and settles when it leaves the window. Not for touch, not for reduced motion. */
function useCardLean() {
  useEffect(() => {
    const wanted = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!wanted.matches) return;
    let frame = 0, x = 0, y = 0;
    const lean = () => {
      frame = 0;
      for (const card of document.querySelectorAll<HTMLElement>(".card-offer:not([data-given])")) {
        const box = card.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) continue;
        const across = Math.max(-1, Math.min(1, (x - (box.left + box.width / 2)) / (innerWidth / 2)));
        const down = Math.max(-1, Math.min(1, (y - (box.top + box.height / 2)) / (innerHeight / 2)));
        card.style.setProperty("--lean-y", `${(across * 1.5).toFixed(2)}deg`);
        card.style.setProperty("--lean-x", `${(-down * 1.5).toFixed(2)}deg`);
        card.dataset.leaning = "";
        // The field that writes on the card lies over it and leans with it.
        const field = card.nextElementSibling;
        if (field instanceof HTMLElement && field.classList.contains("card-for")) { field.style.setProperty("--lean-y", card.style.getPropertyValue("--lean-y")); field.style.setProperty("--lean-x", card.style.getPropertyValue("--lean-x")); field.dataset.leaning = ""; }
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      x = event.clientX; y = event.clientY;
      if (!frame) frame = requestAnimationFrame(lean);
    };
    const rest = () => document.querySelectorAll<HTMLElement>(":is(.card-offer,.card-for)[data-leaning]").forEach(card => { card.style.setProperty("--lean-x", "0deg"); card.style.setProperty("--lean-y", "0deg"); });
    addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    return () => { cancelAnimationFrame(frame); removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", rest); rest(); };
  }, []);
}
