import type { PaintedScene } from "./painted-world-controller";

export type WorldCover = "linen" | "bowl" | "door" | null;
export type LivingWorldFrame = {
  progress: number;
  scene: PaintedScene;
  sourceScene: PaintedScene;
  sceneProgress: number;
  actionProgress: number;
  cover: WorldCover;
  coverProgress: number;
  coverOffset: number;
  fullyCovered: boolean;
};
const scenes: readonly PaintedScene[] = ["opening", "meal", "visit", "welcome", "complete"];
const covers: readonly WorldCover[] = ["linen", "bowl", "door", null];
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

/** The only scene cut occurs while opaque foreground geometry covers the frame. */
export function getLivingWorldFrame(value: number): LivingWorldFrame {
  const progress = clamp(value);
  if (progress >= .88) return { progress, scene: "complete", sourceScene: "complete", sceneProgress: 1, actionProgress: 1, cover: null, coverProgress: 0, coverOffset: 3, fullyCovered: false };
  const position = progress / .22;
  const index = Math.min(3, Math.floor(position));
  const local = position - index;
  const actionProgress = ease((local - .1) / .52);
  const coverProgress = clamp((local - .77) / .08);
  const fullyCovered = index < 3 && coverProgress >= .42 && coverProgress <= .58;
  const switched = index < 3 ? coverProgress >= .5 : local >= .94;
  const scene = switched ? scenes[index + 1] : scenes[index];
  const coverOffset = coverProgress < .42 ? 2.5 * (1 - ease(coverProgress / .42)) : coverProgress > .58 ? -2.5 * ease((coverProgress - .58) / .42) : 0;
  return {
    progress, scene, sourceScene: scenes[index],
    sceneProgress: switched && index < 3 ? 0 : actionProgress,
    actionProgress,
    cover: index < 3 && coverProgress > 0 && coverProgress < 1 ? covers[index] : null,
    coverProgress, coverOffset, fullyCovered,
  };
}
