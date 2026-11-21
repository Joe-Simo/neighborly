/**
 * Sent on the window in the frame a room is shown whole, after the page says so (`.live-app[data-room-shown]`) and
 * before that frame is painted. A listener that arrives late reads the mark instead: the two never disagree.
 * Kept apart from the room's own code so the home page's card can listen without carrying the workspace with it.
 */
export const ROOM_WHOLE = "kh-room-whole";

/**
 * What is under the paper is ready to be seen: the room is shown whole, or the door led somewhere that
 * is not a room and not the waiting screen (a first welcome, a plain notice).
 */
export function underneathIsReady() {
  const room = document.querySelector(".live-app .live-room:not([hidden])");
  // A part of the room that is still on its way says so (`data-room-pending`), and the paper waits for it too.
  if (room) return document.querySelector(".live-app[data-room-shown]") !== null && document.querySelector(".live-app [data-room-pending]:not(.live-room[hidden] *)") === null;
  return document.querySelector(".paper-loading") === null;
}

/** Whatever under the paper is still arriving is finished now: a sheet comes off a room at rest. */
export function restWhatIsUnderneath() {
  for (const move of document.getAnimations()) {
    const on = move.effect instanceof KeyframeEffect ? move.effect.target : null;
    if (on?.closest(".live-app") && move.effect?.getComputedTiming().iterations !== Infinity) move.finish();
  }
}

/** The door's sheet or a room is drawn under the paper, and the picture beside the sheet has arrived. */
export function wholeUnderneath() {
  if (!document.querySelector(".live-app h1") || !underneathIsReady()) return false;
  const picture = document.querySelector<HTMLImageElement>(".entry-art img");
  // A room's head picture says when it is drawn (`data-ready`): the paper never lifts onto the space it will fill.
  const art = document.querySelector(".live-app .live-head-art:not(.live-room[hidden] *)");
  return (!picture || picture.complete) && (!art || art.hasAttribute("data-ready"));
}
