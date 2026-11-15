/** Keep clip time, rather than wall-clock budget, authoritative on slow devices. */
export function needsMuralFrame(
  now: number,
  settleUntil: number,
  clipRunning: boolean,
  paused: boolean,
  reducedMotion: boolean,
): boolean {
  return !paused && !reducedMotion && (clipRunning || now < settleUntil);
}
