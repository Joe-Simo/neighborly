// The page's side of the opening drawn in a worker (painted-world-worker.ts). The page keeps only a canvas and a few
// listeners; three.js is never loaded on its thread. Where a canvas cannot be drawn off the page, the scene is drawn
// here as before (painted-world-controller.ts), with whatever it was already told.
import type { ReliefOutcome } from "./relief-playback";
import type { PaintedPhase, PaintedScene, PaintedWorldOptions, StagePointer } from "./painted-world-controller";

/** The host's size as the page reads it: rounded (clientWidth) and as laid out (its box). */
export type Size = { width: number; height: number; box: { width: number; height: number } };
type Settings = Omit<PaintedWorldOptions, "onLoadingChange" | "onReady" | "onError" | "onSceneChange" | "onPhaseChange">;
export type ToWorker =
  | { kind: "start"; canvas: OffscreenCanvas; options: Settings; pixelRatio: number; size: Size; hidden: boolean; reduce: boolean }
  | { kind: "size"; size: Size }
  | { kind: "visible"; visible: boolean }
  | { kind: "hidden"; hidden: boolean }
  | { kind: "reduce"; reduce: boolean }
  | { kind: "pointer"; event: StagePointer }
  | { kind: "outcome"; value: ReliefOutcome }
  | { kind: "handoff"; value: number | null }
  | { kind: "progress"; value: number }
  | { kind: "reduced"; value: boolean }
  | { kind: "dispose" };
type FromWorker =
  | { kind: "ready" }
  | { kind: "unsupported" }
  | { kind: "scene"; scene: PaintedScene }
  | { kind: "phase"; phase: PaintedPhase }
  | { kind: "loading"; loading: boolean }
  | { kind: "error"; message: string };

export type PaintedWorld = {
  setOpeningOutcome: (value: ReliefOutcome) => void;
  setHandoff: (value: number | null) => void;
  setStoryProgress: (value: number) => void;
  setReducedMotion: (value: boolean) => void;
  dispose: () => void;
};

export function createOffPageWorld(host: HTMLElement, options: PaintedWorldOptions): PaintedWorld {
  const { onLoadingChange, onReady, onError, onSceneChange, onPhaseChange, ...settings } = options;
  // What the page has said so far, for the scene drawn here instead if the worker cannot draw.
  const said: { outcome?: ReliefOutcome; handoff?: number | null; progress?: number; reduced?: boolean } = {};
  let disposed = false;
  let here: PaintedWorld | undefined;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.touchAction = "pan-y";
  host.appendChild(canvas);
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const worker = new Worker(new URL("./painted-world-worker.ts", import.meta.url), { type: "module" });
  const send = (message: ToWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer);

  const measure = (): Size => {
    const { width, height } = host.getBoundingClientRect();
    return { width: host.clientWidth, height: host.clientHeight, box: { width, height } };
  };
  const resize = () => send({ kind: "size", size: measure() });
  const observer = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => send({ kind: "visible", visible: entry.isIntersecting }));
  const visibility = () => send({ kind: "hidden", hidden: document.hidden });
  const reduce = () => send({ kind: "reduce", reduce: media.matches });
  const move = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    send({ kind: "pointer", event: { type: event.type, x: event.clientX - rect.left, y: event.clientY - rect.top, pointerId: event.pointerId, isPrimary: event.isPrimary } });
  };
  const stopListening = () => {
    observer.disconnect();
    intersection.disconnect();
    host.removeEventListener("pointermove", move);
    document.removeEventListener("visibilitychange", visibility);
    media.removeEventListener("change", reduce);
  };

  // Drawn here after all: the worker is let go, and the scene made on this thread with what the page has said.
  const drawHere = () => {
    stopListening();
    worker.terminate();
    canvas.remove();
    void import("./painted-world-controller").then(({ createPaintedWorldController }) => {
      if (disposed) return;
      here = createPaintedWorldController(host, options);
      if (said.reduced !== undefined) here.setReducedMotion(said.reduced);
      if (said.outcome) here.setOpeningOutcome(said.outcome);
      if (said.handoff !== undefined) here.setHandoff(said.handoff);
      if (said.progress !== undefined) here.setStoryProgress(said.progress);
    }).catch((error: unknown) => onError?.(error));
  };

  worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
    if (disposed || here) return;
    switch (data.kind) {
      case "ready": onReady?.(); return;
      case "scene": onSceneChange?.(data.scene); return;
      case "phase": onPhaseChange?.(data.phase); return;
      case "loading": onLoadingChange?.(data.loading); return;
      case "error": onError?.(new Error(data.message)); return;
      case "unsupported": drawHere(); return;
    }
  };
  worker.onerror = (event) => { event.preventDefault(); if (!disposed && !here) drawHere(); };

  const offscreen = canvas.transferControlToOffscreen();
  send({ kind: "start", canvas: offscreen, options: settings, pixelRatio: devicePixelRatio, size: measure(), hidden: document.hidden, reduce: media.matches }, [offscreen]);
  observer.observe(host);
  intersection.observe(host);
  host.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", reduce);

  const call = <Key extends keyof typeof said>(key: Key, value: (typeof said)[Key], message: ToWorker, act: (world: PaintedWorld) => void) => {
    if (disposed) return;
    said[key] = value;
    if (here) act(here);
    else send(message);
  };
  return {
    setOpeningOutcome: (value) => call("outcome", value, { kind: "outcome", value }, (world) => world.setOpeningOutcome(value)),
    setHandoff: (value) => call("handoff", value, { kind: "handoff", value }, (world) => world.setHandoff(value)),
    setStoryProgress: (value) => call("progress", value, { kind: "progress", value }, (world) => world.setStoryProgress(value)),
    setReducedMotion: (value) => call("reduced", value, { kind: "reduced", value }, (world) => world.setReducedMotion(value)),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (here) { here.dispose(); return; }
      stopListening();
      // The worker lets its graphics memory go, then closes; the canvas leaves the page at once.
      send({ kind: "dispose" });
      canvas.remove();
    },
  };
}
