"use client";

import { useEffect, useId, useState, useSyncExternalStore, type CSSProperties } from "react";
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
  if (!move || !moving) return <ReliefPicture name={name} focus={focus} />;
  const sizes = "(min-width: 900px) 46vw, 100vw";
  return (
    <span
      className="relief relief-layers"
      // The piece waits at its start until both layers are in, then makes its move once.
      data-moving={loaded >= 2 ? "" : undefined}
      style={{ "--piece-x": `${move.x ?? 0}px`, "--piece-y": `${move.y ?? 0}px`, "--piece-turn": `${move.turn ?? 0}deg` } as CSSProperties}
    >
      {(["base", "piece"] as const).map((layer) => (
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
            onError={() => setLoaded(2)}
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
