/** Shared camera/opacity choreography, measured in stable viewport heights. */
export function getDepthEntryFrame(travel: number, reduced = false) {
  if (!Number.isFinite(travel)) return { handoff: 0, garden: 0, arrived: false };
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const handoff = reduced ? Number(travel >= 0) : clamp(travel / .25);
  const t = reduced ? 1 : clamp((travel - .25) / .3);
  return { handoff, garden: t * t * (3 - 2 * t), arrived: t === 1 };
}

/** Reveal the final copy when its matching panorama composition is ready. */
export function finalReady(progress: number, reduced = false) {
  return Number.isFinite(progress) && progress >= (reduced ? .975 : .995);
}
