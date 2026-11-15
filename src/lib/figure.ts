const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/** People per dot, a round number that keeps the whole neighborhood under `max` dots. */
export function dotUnit(total: number, max = 720): number {
  return STEPS.find((u) => total / u <= max) ?? Math.ceil(total / max / 10000) * 10000;
}

/** Dots for a count. Anyone at all gets at least one dot, so small groups never vanish. */
export function dotsFor(count: number, unit: number): number {
  return count <= 0 ? 0 : Math.max(1, Math.round(count / unit));
}

/** The three nested layers of the neighborhood figure: everyone, other languages at home, limited English. */
export function figureDots(total: number, otherLanguages: number, limitedEnglish: number) {
  const unit = dotUnit(total);
  const all = dotsFor(total, unit);
  const other = Math.min(all, dotsFor(otherLanguages, unit));
  const limited = Math.min(other, dotsFor(limitedEnglish, unit));
  return { unit, all, other, limited };
}
