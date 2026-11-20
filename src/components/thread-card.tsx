"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { paceOpening } from "@/lib/painted-world-scroll";
import { frameStep } from "@/lib/scroll-frame";
import "./thread-card.css";

/** `k`: its height against a card's own (2:3), so on October's slip it is cut to the slip's proportions on the frame it becomes it. */
type Pose = { x: number; y: number; w: number; r: number; o: number; k: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const swift = (t: number) => 1 - (1 - t) ** 3;
const smooth = (t: number) => t * t * (3 - 2 * t);
type Quad = [number, number][];
/** The CSS matrix that lays a card's own 240 by 160 face onto four corners (top left, top right, bottom right, bottom left): a plane seen in depth, as the canvas draws it. */
const onto = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Quad) => {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, d = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / d, h = (dx1 * sy - sx * dy1) / d;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return `matrix3d(${[a / 240, c / 240, 0, g / 240, b / 160, e / 160, 0, h / 160, 0, 0, 1, 0, x0, y0, 0, 1].map(v => +v.toFixed(6)).join(",")})`;
};
/** Sideways first, then down: the card crosses to its picture's side before that chapter's words come up beside it. */
const between = (from: Pose, to: Pose, t: number): Pose => ({ x: mix(from.x, to.x, 1 - (1 - t) ** 2), y: mix(from.y, to.y, smooth(t)), w: mix(from.w, to.w, t), r: mix(from.r, to.r, smooth(t)), o: mix(from.o, to.o, t), k: mix(from.k, to.k, t) });

/**
 * The card passed at the top never leaves: one card, fixed to the window, goes from picture to picture with the scroll and lies in each one as
 * part of it. Its last place is the year in paper, where it lies as October's first slip and, as the band begins, is that slip (year-paper.tsx).
 */
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
    const chapters = ["call", "visit", "help", "year", "sheet", "ledger"].flatMap(name => { const at = station(name), panel = at?.closest<HTMLElement>(".relief-panel,.home-yes,.year-paper-run"); const tuck = at?.dataset.tuck?.split(",").map(Number); return at && panel ? [{ at, panel, tuck: tuck?.length === 2 ? tuck : null, short: false }] : []; });
    type Stop = (typeof chapters)[number];
    // Each frame the card's way is worked out in the shared frame's first half, where the page's layout is read for free (scroll-frame.ts);
    // what it changes is kept here and done in the second half, with every other part's writes.
    let writes: (() => void)[] = [];
    const draw = (stop: Stop, share: number) => { share *= stop.short ? .4 : 1; const lying = stop.at.firstElementChild, tuck = stop.tuck; if (tuck && lying instanceof HTMLElement) writes.push(() => { lying.style.transform = share > .001 ? `translate(${(tuck[0] * share * 100).toFixed(2)}%,${(tuck[1] * share * 150).toFixed(2)}%)` : ""; }); };
    const drawn = (to: Pose, stop: Stop): Pose => { if (!stop.tuck) return to; const slant = to.r * Math.PI / 180, far = stop.short ? .4 : 1, x = stop.tuck[0] * to.w * far, y = stop.tuck[1] * to.w * far; return { ...to, x: to.x + x * Math.cos(slant) - y * Math.sin(slant), y: to.y + x * Math.sin(slant) + y * Math.cos(slant) }; };
    const hand = station("hand"), journey = world.querySelector<HTMLElement>(".fresco-journey"), frame = world.querySelector<HTMLElement>(".fresco-frame"), stage = world.querySelector<HTMLElement>(".painted-world-viewport");
    if (chapters.length < 4) return;
    world.classList.add("thread-live");
    // Where a station is on the window now: its middle, its drawn width and its turn.
    const poseOf = (at: HTMLElement): Pose => { const box = at.getBoundingClientRect(); const turn = Number(at.dataset.turn ?? 0), slant = Math.abs(turn) * Math.PI / 180;
      // A turned box reports the rectangle around it; the card's own width is found back from that.
      const width = (box.width * Math.cos(slant) - box.height * Math.sin(slant)) / Math.max(.2, Math.cos(2 * slant));
      const height = (box.height * Math.cos(slant) - box.width * Math.sin(slant)) / Math.max(.2, Math.cos(2 * slant));
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, w: width, r: turn, o: 1, k: at.dataset.station === "ledger" && width > 0 ? height / width * 1.5 : 1 }; };
    let here: HTMLElement | null = null;
    const update = () => {
      writes = [];
      const height = innerHeight;
      let pose: Pose | null = null, landed: HTMLElement | null = null, lift = 0, tone = 1;
      // From the open hand to the doors, and through them as they open.
      // It sets out in one cut, as the opening sheet's edge passes the hand: the card is never half there.
      if (hand && frame && journey && stage) {
        const entered = paceOpening(-world.getBoundingClientRect().top / Math.max(1, stage.getBoundingClientRect().height));
        const doors = frame.getBoundingClientRect(), from = poseOf(hand);
        // It rests on the doors where they meet, under the rings, and goes in ahead of the visitor as they open.
        const seam: Pose = { x: doors.left + doors.width / 2, y: doors.top + doors.height * .69, w: from.w * .62, r: -5, o: 1, k: 1 };
        const sets = innerWidth <= 700 ? .5 : .45, out = clamp((entered - sets) / (.95 - sets)), through = smooth(clamp((-journey.getBoundingClientRect().top / height - 1.15) / .6));
        if (out > 0) { pose = between({ ...from, o: 0 }, seam, out); pose.o = 1 - through; pose.w *= 1 - through * .6; pose.y -= through * doors.height * .12; lift = Math.sin(out * Math.PI); tone = clamp(out * 2.5); }
        writes.push(() => hand.parentElement?.toggleAttribute("data-away", out > 0));
      }
      // Chapter by chapter: the card leaves one picture as the next comes into the window.
      let decided = false, warp = 0;
      let last: Pose = pose ? { ...pose, o: 0 } : { x: innerWidth / 2, y: -80, w: 96, r: 0, o: 0, k: 1 };
      const flight = Math.max(76, Math.min(124, innerWidth * .0722));
      let before: Stop | null = null;
      let behind = -Infinity;
      for (const stop of chapters) {
        const { at, panel } = stop, box = panel.getBoundingClientRect(), holds = box.height > height * 1.2;
        const rest = holds ? 0 : (height - box.height) / 2;
        // A chapter that does not hold the window calls the card later, so the card has rested in the picture before.
        const from = height * (holds ? .92 : .62), span = Math.max(1, from - rest);
        const waits = at.dataset.waits === "true", share = stop.tuck || waits ? .7 : .88;
        const to = poseOf(at);
        // Where the words lie between two pictures (one column), the card does not cross them: it is lifted off one picture and set down in the next.
        const words = panel.querySelector<HTMLElement>(".relief-words,.home-yes-words")?.getBoundingClientRect(), place = at.getBoundingClientRect();
        const across = !!words && words.left < place.right && words.right > place.left && (words.bottom <= place.top + 4 || words.top >= place.bottom - 4);
        // Nor does it cross the draft sheet's words on its way out to the year: where the straight way runs over the sheet, it is lifted off and set down instead.
        const sheet = at.dataset.station === "ledger" ? world.querySelector<HTMLElement>(".home-yes-sheet")?.getBoundingClientRect() : null;
        const overSheet = !!sheet && Array.from({ length: 11 }, (_, i) => i / 10).some(t => { const x = mix(last.x, to.x, t), y = mix(last.y, to.y, t); return x > sheet.left - 24 && x < sheet.right + 24 && y > sheet.top - 24 && y < sheet.bottom + 24; });
        const hops = across || overSheet;
        // In one column there is less clear paper round a tucked place, so the card goes in over a shorter way.
        stop.short = hops;
        const ready = drawn(to, stop);
        const over: Pose = waits ? { ...ready, x: ready.x - to.w * .1, y: ready.y - to.w * 1.4, w: to.w * 1.12, r: to.r - 10 } : ready;
        // Its way is a function of the scroll alone, and never quicker than 1.5px of travel to 1px of scroll: where the way between two places is long,
        // it sets out earlier, over as much scroll as it needs (its eases run at most about 2.2 times their mean pace). It still arrives where it always did.
        // A hop's way is its drop onto the place (set down from .7 of a card above, over the last .78 of its scroll, on an ease that runs at most 1.5 times its mean).
        const travel = hops ? to.w * .7 * 1.3 + Math.abs(over.w - last.w) : Math.hypot(over.x - last.x, over.y - last.y) + Math.abs(over.w - last.w);
        // It sets out no earlier than its way to the place before is done (that way's scroll left, `behind`, falls as this one's does, so their difference holds).
        // Where that leaves too little scroll for the way, it lands that much later, rather than hurry.
        // On its way to the year it is drawn onto the slip over arrive .5 to .9 (warp, below), on an ease up to 1.5 times its mean pace: that is travel too.
        const quad = at.dataset.station === "ledger" && at.dataset.quad ? JSON.parse(at.dataset.quad) as Quad : null, slipBox = quad && at.parentElement?.getBoundingClientRect();
        const slant = over.r * Math.PI / 180, cos = Math.cos(slant), sin = Math.sin(slant), half = over.w / 2, tall = over.w * over.k / 3;
        // Its farthest corner's way onto the slip's.
        const warping = quad && slipBox ? Math.max(...[[-half, -tall], [half, -tall], [half, tall], [-half, tall]].map(([u, v], i) => Math.hypot(quad[i][0] + slipBox.left - (over.x + u * cos - v * sin), quad[i][1] + slipBox.top - (over.y + u * sin + v * cos)))) : 0;
        const ahead = box.top - rest - span * (1 - .12 - share), needs = Math.max(span * share, travel * 2.2 / 1.5, warping * 2.5), late = Math.max(0, needs - (ahead - behind));
        const zone = Math.min(needs, Math.max(1, ahead - behind + late)), opened = 1 - (ahead + late) / zone;
        behind = (1 - opened) * zone;
        // In the book the card waits over the page while the page turns, and is laid down once the page lies flat (and the card is there: as late as it came).
        const lies = box.top + late, laid = !waits ? 1 : holds ? clamp((-lies / Math.max(1, box.height - height) - .45) / .5) : clamp((rest - lies) / (height * .18));
        // A card that waits over the book is done with its way only once it lies down: the next way sets out after that.
        if (waits) behind = Math.max(behind, holds ? lies + .95 * Math.max(1, box.height - height) : lies - rest + height * .18);
        // The place before lets its card out the way it went in, over the scroll just before the card leaves, and only then does the card leave.
        if (opened <= 0) { const out = 1 + opened * zone / (span * .12); if (out > 0 && before) draw(before, smooth(clamp(out))); break; }
        tone = 1;
        const arrive = clamp(opened);
        if (arrive < 1 && hops) {
          const up = clamp(arrive / .2), down = clamp((arrive - .22) / .78), above: Pose = { ...over, y: over.y - to.w * (stop.tuck ? 0 : .7), r: over.r - (stop.tuck ? 0 : 6), o: 0 };
          pose = down > 0 ? between(above, over, down) : { ...last, y: last.y - Math.min(to.w * .5, zone * .03) * swift(up), o: 1 - up };
          pose.o = down > 0 ? clamp(down * 3) : before ? 1 - up : 0;
          // Lifted off the sheet, it shows again only once it is clear of the sheet's foot: it never lies over the sheet's words.
          if (overSheet && sheet && down > 0) pose.o *= clamp((pose.y - pose.w * pose.k / 3 - sheet.bottom) / 24); lift = down > 0 ? 1 - down : up; landed = null;
        }
        else if (arrive < 1) { pose = between(last, over, arrive); const air = Math.sin(arrive * Math.PI);
          // In the air it is a little larger than where it lies, rides a low arc and turns a few degrees; it closes on its shadow as it lands.
          pose.w = mix(pose.w, Math.max(pose.w, flight), air); pose.y -= air * flight * .2; pose.r += air * (over.x > last.x ? 5 : -5); pose.o = Math.max(pose.o, clamp(arrive * 6)); lift = Math.sin(arrive * Math.PI); landed = null; if (!waits && arrive > .82) pose.y += Math.sin((arrive - .82) / .18 * Math.PI) * 5; }
        else if (waits && laid < .66) { const down = laid / .66; pose = between(over, ready, down); lift = 1 - down; landed = null; if (down > .7) pose.y += Math.sin((down - .7) / .3 * Math.PI) * 5; }
        else { const tucked = 1 - smooth(!stop.tuck ? 1 : waits ? clamp((laid - .66) / .34) : clamp(((from - lies) / span - .82) / .18)); draw(stop, tucked); pose = { ...to, x: mix(to.x, ready.x, tucked), y: mix(to.y, ready.y, tucked) }; landed = at; }
        // Once it is on its way to the year it is Rosa's slip, decided: the year's own face, its corner green, as it lies in the pile.
        if (at.dataset.station === "ledger") { decided = true; warp = smooth(clamp((arrive - .5) / .4)); }
        last = ready; before = stop;
      }
      writes.push(() => element.toggleAttribute("data-decided", decided));
      // It never crosses the line under the fresco: it comes out onto the paper below it.
      const caption = world.querySelector<HTMLElement>(".fresco-caption")?.getBoundingClientRect();
      if (pose && caption && caption.bottom > 0 && chapters[0].panel.getBoundingClientRect().top < height) pose.o *= clamp((pose.y - pose.w / 3 - caption.bottom - 12) / 36);
      // Nor does it cross "Your turn.": over the heading's height it keeps to the paper right of the last letter, eased in over 160px above and below.
      const head = pose && !landed ? world.querySelector<HTMLElement>("#home-yes-title")?.getBoundingClientRect() : null;
      if (pose && head) {
        const reach = Math.hypot(pose.w / 2, pose.w * pose.k / 3) + 16, clear = head.right + reach;
        const near = smooth(clamp((Math.min(pose.y + reach - head.top, head.bottom - pose.y + reach) + 160) / 160));
        // Where the window has no room right of the heading, the keeping-clear gives way gradually, never in one frame.
        const room = clamp((innerWidth - clear - reach) / 60);
        if (pose.x < clear) pose.x = mix(pose.x, clear, near * room);
      }
      const shown = pose && !landed && pose.o > .01 && pose.y > -pose.w && pose.y < height + pose.w;
      // Over the last of its way to the year, its corners are drawn onto the slip's own (year-paper.tsx), so it is the slip, in depth, on the frame before the cut.
      const ledger = warp > 0 ? station("ledger") : null, quad = ledger?.dataset.quad ? JSON.parse(ledger.dataset.quad) as Quad : null, origin = ledger?.parentElement?.getBoundingClientRect();
      let laidOn = "";
      if (pose && quad && origin) {
        const slant = pose.r * Math.PI / 180, cos = Math.cos(slant), sin = Math.sin(slant), hw = pose.w / 2, hh = pose.w * pose.k / 3, from = pose;
        const own: Quad = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [from.x + u * cos - v * sin, from.y + u * sin + v * cos]);
        // The card's box stands at (-120, -80) on the window (thread-card.css), so its corners are given from there.
        laidOn = onto(own.map(([x, y], i) => [mix(x, quad[i][0] + origin.left, warp) + 120, mix(y, quad[i][1] + origin.top, warp) + 80]));
      }
      const at = pose, lands = landed;
      writes.push(() => {
        if (lands !== here) { here?.classList.remove("is-here"); lands?.classList.add("is-here"); here = lands; }
        element.style.opacity = shown && at ? at.o.toFixed(3) : "0";
        // Unseen, it is still kept where its way has it, so it is never found anywhere else when it shows.
        if (at) {
          element.style.transformOrigin = laidOn ? "0 0" : "";
          element.style.transform = laidOn || `translate3d(${at.x.toFixed(1)}px,${at.y.toFixed(1)}px,0) rotate(${at.r.toFixed(2)}deg) scale(${(at.w / 240).toFixed(4)},${(at.w * at.k / 240).toFixed(4)})`;
          element.style.setProperty("--lift", lift.toFixed(3));
          element.style.setProperty("--tone", tone.toFixed(3));
        }
      });
    };
    // Answers whether the card moved, so it is asked once more and settles on where this frame's writes have put its places.
    let drawnAs = "";
    const write = () => { for (const change of writes) change(); writes = []; const now = `${element.style.transform}|${element.style.opacity}`; const moved = now !== drawnAs; drawnAs = now; return moved; };
    const { ask: request, drop } = frameStep(update, write);
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    update();
    write();
    return () => { drop(); removeEventListener("scroll", request); removeEventListener("resize", request); here?.classList.remove("is-here"); world.classList.remove("thread-live"); };
  }, [world]);
  /* eslint-disable @next/next/no-img-element */
  return <><span ref={mark} hidden />{world && createPortal(<div ref={card} className="thread-card" aria-hidden="true"><i /><img src="/assets/home/card-480.webp" width={480} height={320} alt="" decoding="async" /><img className="thread-card-light" src="/assets/home/card-light-480.webp" width={480} height={320} alt="" decoding="async" /><b className="thread-card-slip"><span /></b></div>, world)}</>;
}

