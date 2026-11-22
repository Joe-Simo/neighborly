/** Paper's one ease: quick to leave, slow to settle. */
import { EASE_PAPER } from "@/lib/motion";
export const PAPER_EASE = EASE_PAPER;
const LAY = 620;

/**
 * A slip laid on a count: carried whole and level from where it is (`dx`, `dy` from its own place) to just above `onto`, then it lies down
 * edge on, one sheet's depth, on `top` (the pile's top sheet, or the count's foot). Its words are lifted off as it begins to lie down
 * (a 0/1 step, `data-lying`), so no line of type is ever seen squeezed. `back` plays the same way in reverse: lifted off the count and
 * stood up, then carried home. Home page (home-year-slip.tsx) and the rooms (the Help line) lay their slips by this one move.
 */
export function laySlip(slip: HTMLElement, onto: DOMRect, top: number, { dx = 0, dy = 0, back = false } = {}) {
  const from = slip.getBoundingClientRect();
  const scale = (onto.width - 8) / from.width;
  const x = onto.left + 4 - from.left, y = top - from.top;
  const frames: Keyframe[] = [
    { transform: `translate(${dx}px, ${dy}px)` },
    { transform: `translate(${x}px, ${y - from.height * scale}px) scale(${scale})`, offset: .7 },
    { transform: `translate(${x}px, ${y}px) scale(${scale}, ${3 / from.height})` },
  ];
  const move = slip.animate(back ? frames.reverse().map((frame, index) => ({ ...frame, offset: index === 1 ? .3 : undefined })) : frames, { duration: LAY, easing: PAPER_EASE, fill: "forwards" });
  if (back) slip.dataset.lying = "true";
  const step = window.setTimeout(() => { if (back) delete slip.dataset.lying; else slip.dataset.lying = "true"; }, LAY * (back ? .3 : .7));
  void move.finished.finally(() => clearTimeout(step)).catch(() => {});
  return move;
}

/** The count's tab tips back off its hinge and stands again, its new number on it: never past 60° off upright. */
export const tipTab = (tab: Element | null | undefined) =>
  tab?.animate([{ transform: "none" }, { transform: "rotateX(60deg)", offset: .45 }, { transform: "none" }], { duration: 380, easing: PAPER_EASE });
