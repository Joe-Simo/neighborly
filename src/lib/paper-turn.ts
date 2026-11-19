/**
 * One book: each chapter after the slip arrives as the next leaf, hinged up from its top edge as its top crosses the window's lower 40%
 * (8° and 24px to flat, done once its top is at 60% of the window), and the leaf above shows a deeper crease while it turns.
 * The leaf leans away from the reader, so perspective only ever narrows it inside its own column. Transforms and one shadow step only:
 * the words turn with their paper at full ink. A leaf is its own layer only while it turns.
 */
export const paperTurnAt = (top: number, height: number) => Math.max(0, Math.min(1, (height - top) / (height * .4)));

/** Writes a leaf's turn (0 entering, 1 flat), only when it has changed; `flat` holds it flat whatever the scroll. */
export function turnLeaf(panel: HTMLElement, leaf: HTMLElement, through: number, flat: boolean) {
  const t = flat ? 1 : through;
  const left = 1 - t * t * (3 - 2 * t);
  // A leaf not yet reached (its top below the window) is left untransformed too: a transformed leaf is a layer of its own, and three of them,
  // drawn and kept while far off screen, cost a phone frames at the top of the page.
  const transform = left <= .0005 || t <= 0 ? "" : `perspective(1400px) translate3d(0,${(24 * left).toFixed(2)}px,0) rotateX(${(-8 * left).toFixed(3)}deg)`;
  if (leaf.style.transform !== transform) leaf.style.transform = transform;
  const turning = transform !== "";
  if (turning !== panel.hasAttribute("data-leaf-turning")) panel.toggleAttribute("data-leaf-turning", turning);
}
