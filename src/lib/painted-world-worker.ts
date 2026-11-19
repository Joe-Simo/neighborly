/// <reference lib="webworker" />
// The opening's scene drawn off the page's thread: three.js, the model's parse, the pictures' upload and the shaders'
// build all happen here, so none of them holds a scroll or a tap. The page (painted-world-offscreen.ts) hands over
// the canvas and tells this worker what it would otherwise read from the page: its size, whether it is seen, the
// reader's motion setting and the pointer.
import { createPaintedWorld, type PaintedStage, type StagePointer } from "./painted-world-controller";
import type { ToWorker } from "./painted-world-offscreen";

declare const self: DedicatedWorkerGlobalScope;

let world: ReturnType<typeof createPaintedWorld> | undefined;
let size = { width: 0, height: 0 };
let hidden = false;
let reduce = false;
let on: Parameters<PaintedStage["listen"]>[0] | undefined;
const tell = (message: unknown) => self.postMessage(message);

self.onmessage = ({ data }: MessageEvent<ToWorker>) => {
  switch (data.kind) {
    case "start": {
      ({ size, hidden, reduce } = data);
      const stage: PaintedStage = {
        canvas: data.canvas, offscreen: true, pixelRatio: data.pixelRatio,
        sketch: (side) => new OffscreenCanvas(side, side),
        width: () => size.width, height: () => size.height,
        hidden: () => hidden, reducedMotion: () => reduce,
        // Only the scroll-led opening is drawn here, which takes no drag: nothing is captured.
        capture: () => {}, release: () => {},
        listen: (handlers) => { on = handlers; return () => { on = undefined; }; },
      };
      try {
        world = createPaintedWorld(stage, {
          ...data.options,
          onReady: () => tell({ kind: "ready" }),
          onSceneChange: (scene) => tell({ kind: "scene", scene }),
          onPhaseChange: (phase) => tell({ kind: "phase", phase }),
          onLoadingChange: (loading) => tell({ kind: "loading", loading }),
          onError: (error) => tell({ kind: "error", message: error instanceof Error ? error.message : String(error) }),
        });
      } catch {
        // No WebGL on a canvas off the page here (Safari before 17): the page draws the scene itself.
        tell({ kind: "unsupported" });
      }
      return;
    }
    case "size": size = { width: data.width, height: data.height }; on?.resize(); return;
    case "visible": on?.visible(data.visible); return;
    case "hidden": hidden = data.hidden; on?.visibility(); return;
    case "reduce": reduce = data.reduce; on?.reduce(); return;
    case "pointer": on?.pointer(data.event satisfies StagePointer); return;
    case "outcome": world?.setOpeningOutcome(data.value); return;
    case "handoff": world?.setHandoff(data.value); return;
    case "progress": world?.setStoryProgress(data.value); return;
    case "reduced": world?.setReducedMotion(data.value); return;
    case "dispose": world?.dispose(); world = undefined; self.close(); return;
  }
};
