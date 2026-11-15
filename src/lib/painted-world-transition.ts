const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Continue from the pose actually shown when a gesture finishes; never rewind it. */
export function getPaintedTransitionInteraction(start: number, transitionProgress: number, actionEnd: number) {
  const initial = clamp(start);
  const progress = clamp(transitionProgress / Math.max(0.001, actionEnd));
  const eased = progress * progress * (3 - 2 * progress);
  return initial + (1 - initial) * eased;
}


/** One human scene is opaque at a time; the cut is inside an opaque paper sweep. */
export function getPaintedSceneCut(value: number, reducedMotion = false) {
  const progress = clamp(value);
  const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
  return {
    incoming: progress >= .5,
    outgoingOpacity: progress >= .5 ? 0 : 1,
    incomingOpacity: progress >= .5 ? 1 : 0,
    coverVisible: !reducedMotion && progress > 0 && progress < 1,
    fullyCovered: progress >= .42 && progress <= .58,
    left: progress <= .58 ? -.1 : -.1 + 1.2 * smooth((progress - .58) / .42),
    right: progress < .42 ? -.1 + 1.2 * smooth(progress / .42) : 1.1,
  };
}
