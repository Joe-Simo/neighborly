"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ReliefPicture, reliefMoves, reliefSources, type ReliefName } from "@/components/workspace/relief";

const ARRIVED = "kind-helps-arrived";
const arrived = () => (sessionStorage.getItem(ARRIVED) ?? "").split(" ").filter(Boolean);
/** True until this picture has made its move in this visit (a browser tab's life); never for anyone who asks for less motion. */
function unseen(name: ReliefName) {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !arrived().includes(name);
  } catch {
    return false;
  }
}

/** What each laying of a picture was told, by its id: it plays, or it does not, for as long as it stands. */
const decided = new Map<string, boolean>();
const noChange = () => () => {};

/**
 * A room's head picture. On the first arrival in a visit, where its two layers exist (`reliefMoves`), the piece
 * makes one small move into its place: the cup is set down, the key goes on its hook. Every other time, and for
 * every picture without layers, it is the flat picture.
 */
export function ArrivingRelief({ name, focus = "70% 50%" }: { name: ReliefName; focus?: string }) {
  const move = reliefMoves[name];
  // Decided once, when the picture is laid, and kept while it stands, so it is never swapped mid-move.
  // A server render and the first pass over it always show the flat picture.
  const laying = useId();
  const moving = useSyncExternalStore(
    noChange,
    () => !!move && (decided.get(laying) ?? (decided.set(laying, unseen(name)), decided.get(laying)!)),
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
  // The piece lies at its start from the moment it is laid. Once every layer is in, it is given its one move
  // home, which holds the start until it begins and the rest once it ends: there is no moment in between
  // where the piece could be painted anywhere else.
  const stack = useRef<HTMLSpanElement>(null);
  const count = move?.front ? 3 : 2;
  useLayoutEffect(() => {
    const piece = stack.current?.querySelector<HTMLElement>(".relief-piece");
    if (!piece || loaded < count || piece.getAnimations().length) return;
    const style = getComputedStyle(piece);
    piece.animate([{ transform: style.transform }, { transform: "none" }], {
      duration: 520,
      // After the head has settled, and after the paper wave where there is one.
      delay: 380 + (parseFloat(style.getPropertyValue("--paper-wait")) || 0),
      easing: style.getPropertyValue("--paper-ease").trim() || "ease-out",
      fill: "both",
    });
  }, [loaded, count]);
  if (!move || !moving) return <ReliefPicture name={name} focus={focus} />;
  const sizes = "(min-width: 900px) 46vw, 100vw";
  // Laid in this order: the base, the piece that moves, and where the cut has one, a still front over the piece.
  const layers = move.front ? (["base", "piece", "front"] as const) : (["base", "piece"] as const);
  return (
    <span
      className="relief relief-layers"
      ref={stack}
      style={{ "--piece-x": `${move.x ?? 0}px`, "--piece-y": `${move.y ?? 0}px`, "--piece-turn": `${move.turn ?? 0}deg`, "--piece-about": move.about ?? "50% 50%" } as CSSProperties}
    >
      {layers.map((layer) => (
        <picture key={layer} className={`relief-${layer}`}>
          <source type="image/avif" srcSet={reliefSources(`${name}-${layer}`, "avif")} sizes={sizes} />
          <source type="image/webp" srcSet={reliefSources(`${name}-${layer}`, "webp")} sizes={sizes} />
          <img
            src={`/assets/relief/relief-${name}-${layer}-1024.webp`}
            alt=""
            width={1536}
            height={1024}
            style={{ objectPosition: focus }}
            ref={(image) => {
              // Already in from the cache: no load event will come.
              if (!image?.complete || image.dataset.in !== undefined) return;
              image.dataset.in = "";
              setLoaded((count) => count + 1);
            }}
            // A layer that cannot be had must not leave the piece out of place.
            onError={() => setLoaded(layers.length)}
            onLoad={({ currentTarget: image }) => {
              if (image.dataset.in !== undefined) return;
              image.dataset.in = "";
              setLoaded((count) => count + 1);
            }}
          />
        </picture>
      ))}
    </span>
  );
}
