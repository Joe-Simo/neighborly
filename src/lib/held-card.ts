import "./held-card.css";

/** The home page's card, grown to the window and held over it while the sample opens. Kept on the body so it outlives the page that drew it. */
export const HELD_CARD = "card-held";

/** The card is let go: it lifts off what is under it, the way the sweep's last sheet does. */
export function dropTheHeldCard() {
  const held = document.getElementById(HELD_CARD);
  if (!held || held.dataset.dropping !== undefined) return;
  held.dataset.dropping = "";
  const sheet = held.firstElementChild;
  const plain = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const leave = sheet instanceof HTMLElement && !plain
    ? sheet.animate([{ transform: "none" }, { transform: `translateY(${-(sheet.getBoundingClientRect().bottom + 70)}px)` }], { duration: 220, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" })
    : held.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
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
