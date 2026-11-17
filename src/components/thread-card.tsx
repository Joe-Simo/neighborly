"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { useCardFor } from "@/lib/card-for";
import "./thread-card.css";

type Pose = { x: number; y: number; w: number; r: number; o: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const swift = (t: number) => 1 - (1 - t) ** 3;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Sideways first, then down: the card crosses to its picture's side before that chapter's words come up beside it. */
const between = (from: Pose, to: Pose, t: number): Pose => ({ x: mix(from.x, to.x, 1 - (1 - t) ** 2), y: mix(from.y, to.y, smooth(t)), w: mix(from.w, to.w, t), r: mix(from.r, to.r, smooth(t)), o: mix(from.o, to.o, t) });

/** The card passed at the top never leaves: one card, fixed to the window, goes from picture to picture with the scroll and lies in each one as part of it. */
export function ThreadCard() {
  const card = useRef<HTMLDivElement>(null), mark = useRef<HTMLSpanElement>(null);
  // The card is drawn at the top of the whole page's world, above the opening that stays pinned over the story.
  const [world, setWorld] = useState<HTMLElement | null>(null);
  useEffect(() => setWorld(mark.current?.closest<HTMLElement>(".neighborly-connected-world") ?? null), []);
  useEffect(() => {
    const element = card.current;
    if (!element || !world || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const station = (name: string) => world.querySelector<HTMLElement>(`[data-station=${name}]`);
    // Every place the card lies after the doors, in order. A tucked place is entered along the card's own edge, by the card that lies there, so it goes under what covers it.
    const chapters = ["call", "visit", "help", "year", "sheet"].flatMap(name => { const at = station(name), panel = at?.closest<HTMLElement>(".relief-panel,.home-yes"); const tuck = at?.dataset.tuck?.split(",").map(Number); return at && panel ? [{ at, panel, tuck: tuck?.length === 2 ? tuck : null, short: false }] : []; });
    type Stop = (typeof chapters)[number];
    const draw = (stop: Stop, share: number) => { share *= stop.short ? .4 : 1; const lying = stop.at.firstElementChild; if (stop.tuck && lying instanceof HTMLElement) lying.style.transform = share > .001 ? `translate(${(stop.tuck[0] * share * 100).toFixed(2)}%,${(stop.tuck[1] * share * 150).toFixed(2)}%)` : ""; };
    const drawn = (to: Pose, stop: Stop): Pose => { if (!stop.tuck) return to; const slant = to.r * Math.PI / 180, far = stop.short ? .4 : 1, x = stop.tuck[0] * to.w * far, y = stop.tuck[1] * to.w * far; return { ...to, x: to.x + x * Math.cos(slant) - y * Math.sin(slant), y: to.y + x * Math.sin(slant) + y * Math.cos(slant) }; };
    const hand = station("hand"), end = station("end"), journey = world.querySelector<HTMLElement>(".fresco-journey"), frame = world.querySelector<HTMLElement>(".fresco-frame"), stage = world.querySelector<HTMLElement>(".painted-world-viewport");
    if (chapters.length < 4 || !end) return;
    world.classList.add("thread-live");
    // Where a station is on the window now: its middle, its drawn width and its turn.
    const poseOf = (at: HTMLElement): Pose => { const box = at.getBoundingClientRect(); const turn = Number(at.dataset.turn ?? 0), slant = Math.abs(turn) * Math.PI / 180;
      // A turned box reports the rectangle around it; the card's own width is found back from that.
      const width = (box.width * Math.cos(slant) - box.height * Math.sin(slant)) / Math.max(.2, Math.cos(2 * slant));
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, w: width, r: turn, o: 1 }; };
    let raf = 0, here: HTMLElement | null = null;
    const update = () => {
      raf = 0;
      const height = innerHeight;
      let pose: Pose | null = null, landed: HTMLElement | null = null, lift = 0, tone = 1;
      // From the open hand to the doors, and through them as they open.
      if (hand && frame && journey && stage) {
        const entered = clamp(-world.getBoundingClientRect().top / Math.max(1, stage.getBoundingClientRect().height));
        const doors = frame.getBoundingClientRect(), from = poseOf(hand);
        // It rests on the doors where they meet, under the rings, and goes in ahead of the visitor as they open.
        const seam: Pose = { x: doors.left + doors.width / 2, y: doors.top + doors.height * .69, w: from.w * .62, r: -5, o: 1 };
        const out = clamp((entered - .45) / .5), through = smooth(clamp((-journey.getBoundingClientRect().top / height - 1.15) / .6));
        if (out > 0) { pose = between({ ...from, o: 0 }, seam, out); pose.o = clamp(out * 5) * (1 - through); pose.w *= 1 - through * .6; pose.y -= through * doors.height * .12; lift = Math.sin(out * Math.PI); tone = clamp(out * 2.5); }
        hand.parentElement?.toggleAttribute("data-away", out > 0);
      }
      // Chapter by chapter: the card leaves one picture as the next comes into the window.
      let last: Pose = pose ? { ...pose, o: 0 } : { x: innerWidth / 2, y: -80, w: 96, r: 0, o: 0 };
      const flight = Math.max(76, Math.min(124, innerWidth * .0722));
      let before: Stop | null = null;
      for (const stop of chapters) {
        const { at, panel } = stop, box = panel.getBoundingClientRect(), holds = box.height > height * 1.2;
        const rest = holds ? 0 : (height - box.height) / 2;
        // A chapter that does not hold the window calls the card later, so the card has rested in the picture before.
        const from = height * (holds ? .92 : .62), coming = clamp((from - box.top) / Math.max(1, from - rest));
        if (coming <= 0) break;
        tone = 1;
        const waits = at.dataset.waits === "true", arrive = clamp((coming - .12) / (stop.tuck || waits ? .7 : .88));
        // The place before lets its card out the way it went in, and only then does the card leave.
        if (arrive <= 0) { if (before) draw(before, smooth(coming / .12)); break; }
        const to = poseOf(at);
        // Where the words lie between two pictures (one column), the card does not cross them: it is lifted off one picture and set down in the next.
        const words = panel.querySelector<HTMLElement>(".relief-words,.home-yes-words")?.getBoundingClientRect(), place = at.getBoundingClientRect();
        const hops = !!words && words.left < place.right && words.right > place.left && (words.bottom <= place.top + 4 || words.top >= place.bottom - 4);
        // In one column there is less clear paper round a tucked place, so the card goes in over a shorter way.
        stop.short = hops;
        const ready = drawn(to, stop);
        // In the book the card waits over the page while the page turns, and is laid down once the page lies flat.
        const laid = !waits ? 1 : holds ? clamp((-box.top / Math.max(1, box.height - height) - .45) / .5) : clamp((rest - box.top) / (height * .18));
        const over: Pose = waits ? { ...ready, x: ready.x - to.w * .1, y: ready.y - to.w * 1.4, w: to.w * 1.12, r: to.r - 10 } : ready;
        if (arrive < 1 && hops) {
          const up = clamp(arrive / .48), down = clamp((arrive - .5) / .5), above: Pose = { ...over, y: over.y - to.w * (stop.tuck ? 0 : .7), r: over.r - (stop.tuck ? 0 : 6), o: 0 };
          pose = down > 0 ? between(above, over, down) : { ...last, y: last.y - to.w * .5 * swift(up), o: 1 - up };
          pose.o = down > 0 ? clamp(down * 3) : before ? 1 - up : 0; lift = down > 0 ? 1 - down : up; landed = null;
        }
        else if (arrive < 1) { pose = between(last, over, arrive); const air = Math.sin(arrive * Math.PI);
          // In the air it is a little larger than where it lies, rides a low arc and turns a few degrees; it closes on its shadow as it lands.
          pose.w = mix(pose.w, Math.max(pose.w, flight), air); pose.y -= air * flight * .2; pose.r += air * (over.x > last.x ? 5 : -5); pose.o = Math.max(pose.o, clamp(arrive * 6)); lift = Math.sin(arrive * Math.PI); landed = null; if (!waits && arrive > .82) pose.y += Math.sin((arrive - .82) / .18 * Math.PI) * 5; }
        else if (waits && laid < .66) { const down = laid / .66; pose = between(over, ready, down); lift = 1 - down; landed = null; if (down > .7) pose.y += Math.sin((down - .7) / .3 * Math.PI) * 5; }
        else { draw(stop, 1 - smooth(!stop.tuck ? 1 : waits ? clamp((laid - .66) / .34) : clamp((coming - .82) / .18))); pose = to; landed = at; }
        last = ready; before = stop;
      }
      // The ending: the card comes in from the right over the cloth, clear of the faces and the words, and down into the open hand. It flies in already lettered, as the card it will be in the hand.
      const band = end.closest<HTMLElement>(".neighborly-close")?.getBoundingClientRect();
      let lettered = false;
      if (band && band.top < height * .6) {
        const to = poseOf(end), down = clamp((height * .6 - band.top) / (height * .52));
        // From the right, at the hand's own height, so it never passes over the words above the hand.
        pose = between({ x: innerWidth + to.w * .55, y: to.y - to.w * .18, w: to.w * 1.1, r: to.r + 16, o: 0 }, to, down);
        pose.o = clamp(down * 5);
        if (down > .82 && down < 1) pose.y += Math.sin((down - .82) / .18 * Math.PI) * 5;
        lift = Math.sin(down * Math.PI); tone = 1; landed = down >= 1 ? end : null; lettered = true;
      }
      element.toggleAttribute("data-lettered", lettered);
      // It never crosses the line under the fresco: it comes out onto the paper below it.
      const caption = world.querySelector<HTMLElement>(".fresco-caption")?.getBoundingClientRect();
      if (pose && caption && caption.bottom > 0 && chapters[0].panel.getBoundingClientRect().top < height) pose.o *= clamp((pose.y - pose.w / 3 - caption.bottom - 12) / 36);
      if (landed !== here) { here?.classList.remove("is-here"); landed?.classList.add("is-here"); here = landed; }
      const shown = pose && !landed && pose.o > .01 && pose.y > -pose.w && pose.y < height + pose.w;
      element.style.opacity = shown && pose ? pose.o.toFixed(3) : "0";
      if (shown && pose) {
        element.style.transform = `translate3d(${pose.x.toFixed(1)}px,${pose.y.toFixed(1)}px,0) rotate(${pose.r.toFixed(2)}deg) scale(${(pose.w / 240).toFixed(4)})`;
        element.style.setProperty("--lift", lift.toFixed(3));
        element.style.setProperty("--tone", tone.toFixed(3));
      }
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    update();
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", request); removeEventListener("resize", request); here?.classList.remove("is-here"); world.classList.remove("thread-live"); };
  }, [world]);
  /* eslint-disable @next/next/no-img-element */
  return <><span ref={mark} hidden />{world && createPortal(<div ref={card} className="thread-card" aria-hidden="true"><i /><img src="/assets/home/card-480.webp" width={480} height={320} alt="" decoding="async" /><img className="thread-card-light" src="/assets/home/card-light-480.webp" width={480} height={320} alt="" decoding="async" /><CardFace /></div>, world)}</>;
}

/** The face the card has in the open hand, drawn on the travelling card for its last flight, so it arrives as itself. */
function CardFace() {
  const name = useCardFor().trim();
  return <span className="thread-card-face">
    <b />
    <ArrowUpRight />
    <em>For <span data-blank={name ? undefined : ""}>{name}</span></em>
    <span className="thread-card-words"><strong>Look around a sample conference</strong><small>Every person in the sample is made up.</small></span>
  </span>;
}
