"use client";

import { frameStep } from "@/lib/scroll-frame";
import { setAct } from "@/lib/chapter-act";
import { paperTurnAt, turnLeaf } from "@/lib/paper-turn";
import { Fragment, useEffect, useRef } from "react";
import { HomeYear } from "./home-year";
import { SlipFolds } from "./slip-folds";
import { PageTurn } from "./chapter-sheets";
import "./relief-journey.css";
import { CutHead } from "@/components/cut-heads";

// Each picture is a plate with loose paper lying on it, listed from the lowest sheet up. A piece that names a shadow casts one on the plate.
// `tuck` is the way it goes in under something, in card widths along its own edges.
// `card` is where the travelling card lies in the picture: on the plate, or on a named piece (moving with it, under whatever is listed after it).
const story = [
  { picture: "call", plate: "call-ground", pieces: [{ name: "cord" }, { name: "piece", shadow: "piece" }], card: { on: null, x: 19, y: 80, w: 15, turn: -9 }, title: "The call.", copy: "Someone rings the help line. The message is kept until someone calls back." },
  { picture: "visit", plate: "visit-ground", pieces: [{ name: "light" }, { name: "leaf", shadow: "leaf" }, { name: "hands", shadow: "hands" }], card: { on: "hands", x: 22.6, y: 61.4, w: 12, turn: 7 }, title: "The visit.", copy: "Two members go to the home, together, and listen." },
  { picture: "help", plate: "help", pieces: [{ name: "envelope", shadow: "piece" }, { name: "flap" }], card: { on: "envelope", x: 60, y: 54, w: 15, turn: -14, tuck: [-.3, -.5] }, title: "The help.", copy: "The conference agrees. The bill is paid straight to the landlord or the utility." },
  { picture: "year", plate: "year", pieces: [{ name: "page", shadow: "piece" }, { name: "ribbon" }], card: { on: "page", x: 66.5, y: 61.5, w: 13, turn: 11, waits: true, tuck: [.5, .12] }, title: "The year.", copy: "Every call, visit and dollar adds itself up for the yearly report." },
] as const;
/** How wide a layer is drawn, not its picture: each chapter cuts closer by drawing its layers wider than the picture (up to 180% on a phone, 125% at a desk). */
const sizes = "(max-width: 820px) 180vw, (max-width: 1100px) and (max-aspect-ratio: 799/1000) 180vw, 125vw";
const layer = (name: string, small: number, large: number, type: string) => `/assets/home/relief-${name}-${small}.${type} ${small}w, /assets/home/relief-${name}-${large}.${type} ${large}w`;

// The card as it lies in a picture. On a piece it is placed in the piece's own box, which is the picture with a margin all round.
const station = ({ picture, card }: (typeof story)[number]) => <span className="card-station" data-station={picture} data-turn={card.turn} data-waits={"waits" in card || undefined} data-tuck={"tuck" in card ? card.tuck.join() : undefined} style={{ left: `${card.x}%`, top: `${card.y}%`, width: `max(${card.w}%, 72px)`, rotate: `${card.turn}deg` }}>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src="/assets/home/card-light-480.webp" width={480} height={320} alt="" loading="lazy" decoding="async" />
</span>;

// One chapter: its words and its picture.
const hold = (part: (typeof story)[number]) => <div className="relief-hold">
      <div className="relief-words"><CutHead>{part.title}</CutHead><p>{part.copy}</p>{part.picture === "year" && <HomeYear />}</div>
      <div className="relief-picture" data-picture={part.picture}>
        <div className="relief-layers">
          <picture>
            <source type="image/avif" srcSet={layer(`${part.plate}-plate`, 768, 1536, "avif")} sizes={sizes} />
            <img src={`/assets/home/relief-${part.plate}-plate-1536.webp`} srcSet={layer(`${part.plate}-plate`, 768, 1536, "webp")} sizes={sizes} width={1536} height={1024} alt="" loading="lazy" decoding="async" />
          </picture>
          {part.pieces.map(piece => <Fragment key={piece.name}>
            <div className="relief-piece" data-piece={piece.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {"shadow" in piece && <img className="relief-shadow" src={`/assets/home/relief-${part.picture}-${piece.shadow}-shadow.webp`} width={400} height={272} alt="" loading="lazy" decoding="async" />}
              <picture>
                <source type="image/avif" srcSet={layer(`${part.picture}-${piece.name}`, 800, 1600, "avif")} sizes={sizes} />
                <img src={`/assets/home/relief-${part.picture}-${piece.name}-1600.webp`} srcSet={layer(`${part.picture}-${piece.name}`, 800, 1600, "webp")} sizes={sizes} width={1600} height={1088} alt="" loading="lazy" decoding="async" />
              </picture>
              {part.card.on === piece.name && !("waits" in part.card) && station(part)}
            </div>
            {part.card.on === piece.name && "waits" in part.card && station(part)}
          </Fragment>)}
          {part.card.on === null && station(part)}
        </div>
      </div>
      </div>
;

/** What a conference does with Kind Helps, one idea to a screen, each with its own cut-paper picture. */
export function ReliefStory() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const panels = [...element.querySelectorAll<HTMLElement>(".relief-panel")];
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    // Read in the shared frame's first half, before any part of the page has written (scroll-frame.ts).
    let height = innerHeight, near = false, boxes: DOMRect[] = [];
    // The chapters after the slip each arrive as the next leaf (paper-turn.ts). One already in the window when the page is first drawn, or one
    // the keyboard has entered, lies flat until it has left the window below, so the first frame is the page as drawn and focus never lands on a turning leaf.
    const leaves = panels.slice(1).map(panel => ({ panel, leaf: panel.querySelector<HTMLElement>(".relief-hold") }));
    // Phones keep their chapters flat: at 4x CPU the turn cost an occasional frame past budget, so it is drawn from 1024 up only.
    const wide = matchMedia("(min-width: 1024px)");
    const flat = new Set<HTMLElement>();
    let seeded = false;
    const focused = (event: FocusEvent) => { const panel = (event.target as Element | null)?.closest<HTMLElement>(".relief-panel"); if (panel) { flat.add(panel); request(); } };
    const read = () => {
      height = innerHeight;
      const bounds = element.getBoundingClientRect();
      near = !(bounds.bottom < -height || bounds.top > height * 2);
      boxes = near ? panels.map(panel => panel.getBoundingClientRect()) : [];
      // Seeded from the first frame's own read, so nothing is measured at mount; a story out of reach then has no chapter in the window.
      if (!seeded) { seeded = true; boxes.forEach((box, index) => { if (box.top < height) flat.add(panels[index]); }); }
    };
    const update = () => {
      if (!near) return;
      for (const [index, panel] of panels.entries()) {
        // The chapter found under a turned page is already lying in its place: the turn sets its act.
        if (panel.dataset.turn === "to") continue;
        const box = boxes[index];
        const holds = box.height > height * 1.2;
        // Coming in: 0 as the chapter's top enters the window, 1 once it reaches the top (or, where nothing holds, once the chapter is centred).
        const rest = holds ? 0 : (height - box.height) / 2;
        const e = Math.max(0, Math.min(1, (height * .92 - box.top) / Math.max(1, height * .92 - rest)));
        // Holding: the chapter's one act, done by 85% of the hold so the finished picture rests before the page moves on.
        const h = holds ? Math.max(0, Math.min(1, -box.top / Math.max(1, (box.height - height) * .85))) : Math.max(0, Math.min(1, (e - .35) / .65));
        // Written only when changed: a chapter at rest, or one not yet reached, is not styled again on every frame of the scroll.
        const nowE = (1 - (1 - e) ** 3).toFixed(4), nowH = (h * h * (3 - 2 * h)).toFixed(4);
        setAct(panel, nowE, nowH);
      }
      for (const { panel, leaf } of leaves) {
        // The chapter found under a turned page is not a new leaf: the page turn above it is its arrival.
        if (!leaf || panel.dataset.turn === "to") continue;
        const top = boxes[panels.indexOf(panel)].top;
        if (top > height) flat.delete(panel);
        turnLeaf(panel, leaf, paperTurnAt(top, height), flat.has(panel) || !wide.matches);
      }
    };
    const { ask: request, drop } = frameStep(read, update);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    element.addEventListener("focusin", focused);
    read();
    update();
    return () => { drop(); window.removeEventListener("scroll", request); window.removeEventListener("resize", request); element.removeEventListener("focusin", focused); };
  }, []);
  return <section ref={root} className="relief-story" aria-label="What a conference does with Kind Helps">
    {story.map((part, index) => <Fragment key={part.picture}>
      <article className="relief-panel" data-chapter={part.picture} data-side={index % 2 ? "left" : "right"}>
        {part.picture === "help" ? <PageTurn>{hold(part)}</PageTurn> : hold(part)}
      </article>
      {/* The call, once written down, folds and is laid on the year's pile: the slip between the call and the visit (slip-folds.tsx). */}
      {part.picture === "call" && <SlipFolds />}
    </Fragment>)}
  </section>;
}
