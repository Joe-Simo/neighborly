"use client";

import { useLayoutEffect, useRef, useSyncExternalStore, type PointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Engraved illustrations explain the selected kind of care; they are not account data. */
export function CareComposition({ selected, onMotion }: { selected: 0 | 1 | 2; onMotion?: () => void }) {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const root = useRef<HTMLDivElement>(null);
  const wake = useRef<() => void>(() => {});
  const values = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, progress: 1, targetProgress: 1, started: 0, reduced: false });
  const touch = useRef<{ x: number; y: number; dragged: boolean } | null>(null);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    const state = values.current;
    const write = () => {
      node.style.setProperty("--care-x", String(state.x));
      node.style.setProperty("--care-y", String(state.y));
      node.style.setProperty("--care-progress", String(state.progress));
    };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0; touch.current = null;
      Object.assign(state, { x: 0, y: 0, targetX: 0, targetY: 0, progress: 1, targetProgress: 1, started: 0, reduced: media.matches });
      node.removeAttribute("data-playing"); write();
    };
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden) { reset(); return; }
      const blend = 1 - Math.exp(-Math.min(last ? (now - last) / 1000 : 1 / 60, .05) * 12);
      last = now;
      state.x += (state.targetX - state.x) * blend;
      state.y += (state.targetY - state.y) * blend;
      if (state.started) {
        const t = Math.min(1, (now - state.started) / (state.reduced ? 220 : 2300));
        state.progress = state.reduced ? 1 : t * t * (3 - 2 * t);
        if (t === 1) { state.started = 0; node.removeAttribute("data-playing"); }
      } else state.progress += (state.targetProgress - state.progress) * blend;
      const unsettled = Math.abs(state.x - state.targetX) + Math.abs(state.y - state.targetY) + Math.abs(state.progress - state.targetProgress) > .001;
      if (!unsettled && !state.started) { state.x = state.targetX; state.y = state.targetY; state.progress = state.targetProgress; }
      write();
      if (unsettled || state.started) frame = requestAnimationFrame(tick);
    };
    reset();
    wake.current = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(tick); };
    media.addEventListener("change", reset);
    document.addEventListener("visibilitychange", reset);
    return () => { reset(); wake.current = () => {}; media.removeEventListener("change", reset); document.removeEventListener("visibilitychange", reset); };
  }, [selected]);
  const play = () => {
    onMotion?.();
    values.current.started = performance.now();
    values.current.targetProgress = 1;
    values.current.progress = values.current.reduced ? 1 : 0;
    root.current?.setAttribute("data-playing", "true");
    wake.current();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const state = values.current;
    if (state.reduced) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (touch.current) {
      const dx = event.clientX - touch.current.x;
      const dy = event.clientY - touch.current.y;
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      touch.current.dragged = true;
      state.started = 0;
      root.current?.removeAttribute("data-playing");
      state.targetProgress = Math.max(0, Math.min(1, .5 + dx / bounds.width));
    }
    state.targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    state.targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    wake.current();
  };
  const settle = () => { Object.assign(values.current, { targetX: 0, targetY: 0, targetProgress: 1 }); touch.current = null; wake.current(); };
  return <div className="care-composition" data-kind={selected} ref={root}>
    <div className="care-touch-surface" onPointerMove={move} onPointerLeave={settle} onPointerDown={event => { touch.current = { x: event.clientX, y: event.clientY, dragged: false }; }} onPointerUp={() => { if (touch.current && !touch.current.dragged) play(); settle(); }} onPointerCancel={settle}>
    <svg viewBox="0 0 480 330" fill="none" key={selected} aria-hidden="true">

      <defs><pattern id="care-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path pathLength={1} d="M0 0V7" stroke="currentColor" strokeOpacity=".15" /></pattern></defs>
      <path pathLength={1} className="care-ground" d="M35 287C136 272 326 272 445 287" />
      {selected === 0 && <g className="care-drawing care-clock">
        <circle pathLength={1} cx="240" cy="158" r="112" fill="url(#care-hatch)" strokeWidth="1" />
        <circle pathLength={1} cx="240" cy="158" r="102" strokeWidth="1.5" />
        {Array.from({length: 12}, (_, index) => <path pathLength={1} key={index} d="M240 66V73" transform={`rotate(${index * 30} 240 158)`} />)}
        <path pathLength={1} className="care-gold" d="M240 56A102 102 0 0 1 342 158" strokeWidth="5" />
        <path pathLength={1} className="care-clock-hand" d="M240 87V158L286 185" strokeWidth="3" strokeLinecap="round" />
        <circle pathLength={1} cx="240" cy="158" r="5" fill="currentColor" />
        <path pathLength={1} d="M127 162C79 146 67 191 96 206M353 126C395 110 416 143 392 163" strokeWidth="1" />
        <path pathLength={1} d="M93 195L95 207L107 204M387 153L391 165L402 158" />
      </g>}
      {selected === 1 && <g className="care-drawing care-plant">
        <path pathLength={1} d="M145 277C181 239 221 192 243 139C253 113 261 82 263 54" strokeWidth="2" />
        <path pathLength={1} d="M218 192C153 196 128 167 127 136C173 125 211 145 218 192ZM246 140C289 143 323 115 331 81C281 73 249 95 246 140ZM259 96C230 76 220 46 232 23C265 36 276 64 259 96Z" fill="url(#care-hatch)" strokeWidth="1.5" />
        <path pathLength={1} d="M172 246C126 248 102 229 97 206C128 195 160 206 172 246ZM221 187C263 200 295 187 313 160C273 142 240 153 221 187Z" fill="url(#care-hatch)" strokeWidth="1.5" />
        <path pathLength={1} className="care-gold" d="M147 277C188 230 218 185 244 134" strokeWidth="4" />
        <path pathLength={1} d="M145 277L111 285M146 277L163 291M145 277L134 299" />
        <path pathLength={1} d="M338 198V213M330 206H346M110 78V89M105 84H116" className="care-gold" />
      </g>}
      {selected === 2 && <g className="care-drawing care-gathering">
        <path pathLength={1} d="M116 270V140C116 72 171 26 240 26C309 26 364 72 364 140V270" strokeWidth="1" />
        <path pathLength={1} d="M129 270V141C129 81 179 40 240 40C301 40 351 81 351 141V270" strokeWidth="1.5" />
        <path pathLength={1} className="care-gold" d="M129 143C161 105 200 101 240 116C280 101 320 105 351 143" strokeWidth="2" />
        <circle pathLength={1} cx="170" cy="190" r="20" fill="url(#care-hatch)" /><circle pathLength={1} cx="240" cy="162" r="24" fill="url(#care-hatch)" /><circle pathLength={1} cx="310" cy="190" r="20" fill="url(#care-hatch)" />
        <path pathLength={1} d="M138 268V245C138 214 201 214 201 245V268M201 268V222C201 187 279 187 279 222V268M279 268V245C279 214 342 214 342 245V268" strokeWidth="1.5" />
        <path pathLength={1} className="care-gold" d="M183 229C218 250 267 250 296 229" strokeWidth="2" />
      </g>}
      <text x="240" y="321" textAnchor="middle">{["A moment given. A connection made.","What comes naturally can make a difference.","A shared purpose brings us together."][selected]}</text>
    </svg></div>
    <Button type="button" variant="ghost" className="care-play" disabled={!ready} onClick={play} aria-label="Set the illustration in motion"><RotateCcw size={13} aria-hidden="true" />Set in motion</Button>
  </div>;
}
