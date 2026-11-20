import "./held-card.css";

/** The home page's card, grown to the window and held over it while the sample opens. Kept on the body so it outlives the page that drew it. */
export const HELD_CARD = "card-held";

/** The card is let go: it lifts off what is under it, the way the sweep's last sheet does. */
export function dropTheHeldCard() {
  const held = document.getElementById(HELD_CARD);
  if (!held || held.dataset.dropping !== undefined) return;
  held.dataset.dropping = "";
  // With less motion asked for it is simply gone: one cut, nothing played.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return held.remove();
  // The whole grown card lifts as one sheet, its paper, square and name together, so what is under it is seen from the first frame of the lift.
  const leave = held.animate([{ transform: "none" }, { transform: `translateY(${-(held.getBoundingClientRect().height + 70)}px)` }], { duration: 220, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" });
  leave.finished.then(() => held.remove(), () => held.remove());
}

/** The sweep takes the card over in the same frame: the one on the body goes, the sweep's own is already there at full size. */
export function takeTheHeldCard() {
  const held = document.getElementById(HELD_CARD);
  if (!held || held.dataset.dropping !== undefined) return false;
  // It stays over the door's card, identical to it, until the door has drawn its own "Opening…" (or a few frames have
  // passed), so no frame is ever without the paper's line.
  let frames = 0;
  const leave = () => {
    if (document.querySelector(".door-sweep .door-opening") || ++frames > 6) return held.remove();
    requestAnimationFrame(leave);
  };
  requestAnimationFrame(leave);
  return true;
}
