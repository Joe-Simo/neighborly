/** Light on purpose: asked for from pages with no workspace (the sample link), so it carries nothing of the room. */
import { reliefMoves, reliefSources, type ReliefName } from "@/components/workspace/relief";

export const ARRIVED = "kind-helps-arrived";
export const arrived = () => (sessionStorage.getItem(ARRIVED) ?? "").split(" ").filter(Boolean);
/** The iPhone app's first room, still under its launch cover: its picture is shown already in place. */
const underLaunchCover = () => document.documentElement.dataset.shell === "ios" && !document.querySelector(".live-app[data-room-in]");
/** True until this picture has made its move in this visit (a browser tab's life); never for anyone who asks for less motion. */
export function unseen(name: ReliefName) {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !underLaunchCover() && !arrived().includes(name);
  } catch {
    return false;
  }
}

export const SIZES = "(min-width: 900px) 46vw, 100vw";
const fetched = new Set<string>();
/**
 * Fetches the head pictures of rooms not yet opened, in the cut each will first be shown in, so that going
 * to a room finds its picture already here. Asked for once the first room has settled, never before it.
 */
export function fetchAhead(names: readonly ReliefName[]) {
  for (const name of names) {
    const move = reliefMoves[name];
    const cuts = move && unseen(name) ? ["-base", "-piece", ...(move.front ? ["-front"] : [])] : [""];
    for (const cut of cuts) {
      if (fetched.has(name + cut)) continue;
      fetched.add(name + cut);
      const link = document.createElement("link");
      Object.assign(link, { rel: "preload", as: "image", type: "image/avif", imageSrcset: reliefSources(name + cut, "avif"), imageSizes: SIZES });
      document.head.append(link);
    }
  }
}
