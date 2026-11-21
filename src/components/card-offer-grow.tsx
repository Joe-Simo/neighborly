"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, type MouseEvent } from "react";
import { CardOffer } from "./card-offer";
import type { CardWords } from "./public-ending";
import { useSampleDoor } from "./sample-link";
import { writeCardWord } from "@/lib/card-for";
import { HELD_CARD, dropTheHeldCard } from "@/lib/held-card";
import { ROOM_WHOLE } from "@/lib/room-whole";

/** The card grows from the hand until it is the window's paper, and is held there until the door's sweep takes it over. */
const GROW = 520;
/** If nothing on the other side takes the card (an error, a visitor already inside), it is let go rather than held for ever. */
const LONGEST = 12000;
const EASE = "cubic-bezier(.3,.6,.2,1)";
/** On a wide window the card starts slowly, so it is seen as the card, words and all, before it fills the window; a fast start covered the window in about 120ms. */
const WIDE = "cubic-bezier(.55,0,.25,1)";
/** The gold square rides the card until the paper's cut, and is at rest this far past it. */
const SETTLE = .12;
/** Where on home the visitor gave the card, so the way back lands there even when home is still laying its long scroll. */
const LEFT_AT = "home-left-at";

/** Pressed, the card is not left behind: the same card, words and all, grows to the window and becomes the first sheet of the room. */
export function CardOfferGrow({ said }: { said: CardWords }) {
  const router = useRouter();
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // The word lettered on this card goes with it, whether or not it grows: the door letters the same one.
    writeCardWord(said.for);
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
    try { sessionStorage.setItem(LEFT_AT, String(Math.round(scrollY))); } catch {}
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
    // The card's own square goes with its words: until the swap it is the card's mark, riding the card, so it never crosses a word.
    for (const mark of sheet.children) mark.animate(swap(1, 0), { ...timing, duration: narrow ? GROW + 200 : GROW, easing: "linear" });
    // As the words give way, the grown card's own marks come up in the same moment, where the door's card has them: the card is never blank paper.
    const marks = document.createElement("div");
    marks.className = "card-held-marks";
    const square = document.createElement("i");
    marks.append(square);
    // The name written on the card is lettered on the grown paper too, where the door's card will be, so it is still the visitor's card.
    const written = offer.querySelector(".card-offer-for span")?.textContent?.trim();
    // On the card the name is lettered on its paper, so it grows with the card and keeps its place over the square; the grown card letters it again over its own square, as the door does.
    const line = written ? document.createElement("em") : null;
    if (line) { line.textContent = `${said.for} ${written}`; marks.append(line); }
    // Under the marks, from the same frame, the paper they sit on is the door's fixed paper: the grain stops growing with the card.
    const paper = document.createElement("div");
    paper.className = "card-held-paper";
    held.append(paper, marks);
    const span = narrow ? GROW + 200 : GROW;
    const cover = paper.animate(swap(0, 1), { ...timing, duration: span, easing: "linear" });
    line?.animate(swap(0, 1), { ...timing, duration: narrow ? GROW + 200 : GROW, easing: "linear" });
    // One gold square all the way: in the frame of the swap the paper's square takes over from the card's own, where the card's
    // square is in that frame and turned as it is, and only then travels, on bare paper, to rest where the door's card has it.
    const own = sheet.querySelector<HTMLElement>(":scope > i");
    if (own) {
      square.style.opacity = "0";
      const at = fade * span, settle = SETTLE * span;
      const pose = (box: DOMRect, to: DOMRect) => `translate(${box.left + box.width / 2 - (to.left + to.width / 2)}px,${box.top + box.height / 2 - (to.top + to.height / 2)}px) scale(${box.width / to.width})`;
      const handOver = () => {
        if (!held.isConnected) return;
        if (Number(grow.currentTime ?? 0) < at - 17 && grow.playState !== "finished") return void requestAnimationFrame(handOver);
        const to = square.getBoundingClientRect();
        square.style.opacity = "";
        square.animate([{ transform: pose(own.getBoundingClientRect(), to), opacity: 1 }, { transform: "none", opacity: .4 }], { duration: settle, easing: EASE, fill: "forwards" });
      };
      requestAnimationFrame(handOver);
    }
    // The room is asked for in the first frame the paper covers the window, not at the grow's end: it is laid and drawn whole under the
    // paper while the card goes on growing, and it is never seen round a half-grown card.
    const covered = (fade + .001) * span;
    const ask = () => {
      if (!held.isConnected) return;
      if (Number(cover.currentTime ?? 0) < covered && cover.playState !== "finished") return void requestAnimationFrame(ask);
      // The page is taken to its top here, under the paper that now covers the whole window, and the room is asked for
      // without the router's own scroll: that one measured the new page inside the commit that lays it, a frame's worth.
      scrollTo({ top: 0, behavior: "instant" });
      router.push(href, { scroll: false });
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
        line.textContent = said.opening;
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
  useCardInHand();
  return <CardOffer said={said} door={useSampleDoor(open)} />;
}

/** Home is whole on every visit: coming back, the card lies in the hand again before the page is shown, with no animation, whether the
 * page is shown again by the router (its layout effects run before paint) or from the browser's back-forward cache. */
function useCardInHand() {
  useLayoutEffect(() => {
    const restore = () => {
      for (const card of document.querySelectorAll<HTMLElement>(".card-offer[data-given]")) {
        delete card.dataset.given;
        // Its words are on it from the first frame: lettered at once, not faded in as if it had just landed.
        card.dataset.back = "";
        card.classList.add("is-here");
      }
      let left: number | null = null;
      try { const kept = sessionStorage.getItem(LEFT_AT); sessionStorage.removeItem(LEFT_AT); left = kept === null ? null : Number(kept); } catch {}
      if (left === null || !Number.isFinite(left)) return;
      const y = left;
      // Back where the card was given: at once if home is long enough to stand there, else as soon as it is (or after a second).
      let tries = 60;
      const settle = () => {
        if (document.documentElement.scrollHeight - innerHeight >= y || --tries === 0) window.scrollTo({ top: y, behavior: "instant" });
        else requestAnimationFrame(settle);
      };
      settle();
    };
    restore();
    const settled = () => document.querySelectorAll<HTMLElement>(".card-offer[data-back]").forEach(card => delete card.dataset.back);
    const shown = (event: PageTransitionEvent) => { if (event.persisted) restore(); };
    addEventListener("pageshow", shown);
    addEventListener("pointerdown", settled, { once: true });
    addEventListener("wheel", settled, { once: true, passive: true });
    addEventListener("touchmove", settled, { once: true, passive: true });
    return () => { removeEventListener("pageshow", shown); removeEventListener("pointerdown", settled); removeEventListener("wheel", settled); removeEventListener("touchmove", settled); };
  }, []);
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
