"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type AnimationEventHandler, type CSSProperties } from "react";
import { ReliefPicture, reliefMoves, reliefSources, whenDecoded, type ReliefName } from "@/components/workspace/relief";
import { ARRIVED, arrived, SIZES, unseen } from "@/components/workspace/relief-ahead";
import { useRoomShown } from "@/components/workspace/room-sheet";

/** What each laying of a picture was told, by its id: it plays, or it does not, for as long as it stands. */
const decided = new Map<string, boolean>();
const noChange = () => () => {};
/** Whether a room's picture has been laid since the page loaded: the first is the page loading, every later one a switch. */
let pageLaid = false;
/** A picture moves only when the person switched to its room inside the app, never on a page's own load. */
function plays(name: ReliefName) {
  const switched = pageLaid;
  pageLaid = true;
  return switched && unseen(name);
}

/**
 * A room's head picture. When the person switches to a room inside the app and it is that room's first arrival in
 * the visit, where its two layers exist (`reliefMoves`), the piece makes one small move into its place: the cup is
 * set down, the key goes on its hook. On a page's own load, every other time, and for every picture without layers,
 * it is the flat picture, at its end state.
 */
export function ArrivingRelief({
  name,
  focus = "70% 50%",
  band,
  onReady,
  className,
  onAnimationEnd,
}: {
  name: ReliefName;
  focus?: string;
  /** Where the phone's band looks, from 0 at the picture's top to 1 at its foot. */
  band?: number;
  onReady: () => void;
  className?: string;
  onAnimationEnd?: AnimationEventHandler<HTMLElement>;
}) {
  const move = reliefMoves[name];
  // Decided once, when the picture is laid, and kept while it stands, so it is never swapped mid-move.
  // A server render and the first pass over it always show the flat picture.
  const laying = useId();
  const moving = useSyncExternalStore(
    noChange,
    () => decided.get(laying) ?? (decided.set(laying, plays(name) && !!move), decided.get(laying)!),
    () => false,
  );
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    if (!moving) return;
    try {
      sessionStorage.setItem(ARRIVED, [...new Set([...arrived(), name])].join(" "));
    } catch {
      // No storage: the move plays on each first laying of the picture, which is harmless.
    }
  }, [moving, name]);
  // The piece lies at its start from the moment it is laid. Once every layer is in and the room is shown, it is
  // given its one move home, which holds the start until it begins and the rest once it ends: there is no moment
  // in between where the piece could be painted anywhere else.
  const stack = useRef<HTMLSpanElement>(null);
  const count = move?.front ? 3 : 2;
  const seen = useRoomShown();
  // The move is given in the frame after the room is shown: the piece already lies at its start there, and reading
  // its style in the frame the room arrives would make the page work out the whole room's styles twice.
  const given = useRef(false);
  useEffect(() => {
    const piece = stack.current?.querySelector<HTMLElement>(".relief-piece");
    if (!seen || !piece || loaded < count || given.current) return;
    const frame = requestAnimationFrame(() => {
      given.current = true;
      const style = getComputedStyle(piece);
      piece.animate([{ transform: style.transform }, { transform: "none" }], {
        duration: 520,
        // A moment after the room is shown, and after the paper wave where there is one.
        delay: 380 + (parseFloat(style.getPropertyValue("--paper-wait")) || 0),
        easing: style.getPropertyValue("--paper-ease").trim() || "ease-out",
        fill: "both",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [seen, loaded, count]);
  // The room is not shown before its picture can be painted (room-sheet.tsx): every layer is in, or could not be had.
  const layersIn = moving && loaded >= count;
  useEffect(() => {
    if (layersIn) onReady();
  }, [layersIn, onReady]);
  const placed = band === undefined ? undefined : ({ "--relief-y": band } as CSSProperties);
  if (!move || !moving)
    return <ReliefPicture priority name={name} focus={focus} onReady={onReady} className={className} style={placed} onAnimationEnd={onAnimationEnd} />;
  const layerIn = (image: HTMLImageElement) => {
    if (image.dataset.in !== undefined) return;
    image.dataset.in = "";
    whenDecoded(image, () => setLoaded((count) => count + 1));
  };
  const sizes = SIZES;
  // Laid in this order: the base, the piece that moves, and where the cut has one, a still front over the piece.
  const layers = move.front ? (["base", "piece", "front"] as const) : (["base", "piece"] as const);
  return (
    <span
      className={`relief relief-layers${className ? ` ${className}` : ""}`}
      ref={stack}
      onAnimationEnd={onAnimationEnd}
      style={{ ...placed, "--piece-x": `${move.x ?? 0}px`, "--piece-y": `${move.y ?? 0}px`, "--piece-turn": `${move.turn ?? 0}deg`, "--piece-about": move.about ?? "50% 50%" } as CSSProperties}
    >
      {layers.map((layer) => (
        <picture key={layer} className={`relief-${layer}`}>
          <source type="image/avif" srcSet={reliefSources(`${name}-${layer}`, "avif")} sizes={sizes} />
          <source type="image/webp" srcSet={reliefSources(`${name}-${layer}`, "webp")} sizes={sizes} />
          <img
            src={`/assets/relief/relief-${name}-${layer}-1024.webp`}
            alt=""
            fetchPriority="high"
            width={1536}
            height={1024}
            style={{ objectPosition: focus }}
            // Already in from the cache: no load event will come.
            ref={(image) => void (image?.complete && layerIn(image))}
            // A layer that cannot be had must not leave the piece out of place.
            onError={() => setLoaded(layers.length)}
            onLoad={({ currentTarget }) => layerIn(currentTarget)}
          />
        </picture>
      ))}
    </span>
  );
}
