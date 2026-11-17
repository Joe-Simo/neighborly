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
  // The two cards are laid out by the same rule, but a phone's bars can change the window between the pages by a few pixels.
  // The sweep's card starts exactly where the held one's square was and settles into its own place, so the square and the name never jump.
  const from = held.querySelector(".card-held-marks>i")?.getBoundingClientRect();
  held.remove();
  const card = document.querySelector<HTMLElement>(".door-sweep .door-card"), to = card?.querySelector(":scope>i")?.getBoundingClientRect();
  if (card && from && to && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const dx = from.left - to.left, dy = from.top - to.top;
    if (Math.hypot(dx, dy) >= .5) card.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" });
  }
  return true;
}
