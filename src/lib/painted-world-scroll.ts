import type { PaintedPhase, PaintedScene } from "./painted-world-controller";

const sequence: readonly PaintedScene[] = ["opening", "meal", "visit", "welcome", "complete"];
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export type PaintedScrollState = {
  progress: number;
  scene: PaintedScene;
  nextScene: PaintedScene | null;
  captionScene: PaintedScene;
  localProgress: number;
  interaction: number;
  dissolve: number;
  phase: PaintedPhase;
};

/** One reversible timeline; the final 12% lets the gathering breathe. */
export function getPaintedScrollState(value: number): PaintedScrollState {
  const progress = clamp(value);
  if (progress >= 0.88) return { progress, scene: "complete", nextScene: null, captionScene: "complete", localProgress: 1, interaction: 1, dissolve: 0, phase: "idle" };
  const position = progress / 0.22;
  const index = Math.min(3, Math.floor(position));
  const localProgress = position - index;
  const scene = sequence[index];
  const nextScene = sequence[index + 1];
  const interaction = smooth((localProgress - 0.38) / 0.4);
  const dissolve = smooth((localProgress - 0.85) / 0.08);
  return {
    progress, scene, nextScene,
    captionScene: dissolve >= 0.5 ? nextScene : scene,
    localProgress, interaction, dissolve,
    phase: dissolve > 0 ? "transitioning" : interaction > 0 ? "interacting" : "idle",
  };
}

/**
 * The opening's sheet answers the first pixel of scroll and stays under the finger: its lift is spread evenly over the whole of the pin,
 * so its edge rises a little faster than the page is scrolled from the first frame to the last.
 * Everything that follows the sheet's edge was timed against a lift that began at .4 of the pin, so the scroll is given back on that old scale.
 */
export function paceOpening(value: number): number {
  const progress = clamp(value);
  return progress >= .8 ? progress : .4 + progress * .5;
}
