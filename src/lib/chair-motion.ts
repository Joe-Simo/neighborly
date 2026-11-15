/** Frame-rate-independent settling for the chair's authored pull gesture. */
export function stepChair(current: number, target: number, dt: number, reduced = false) {
  if (reduced) return target;
  const seconds = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
  const next = target + (current - target) * Math.exp(-7.7 * seconds);
  return Math.abs(next - target) < .001 ? target : next;
}
