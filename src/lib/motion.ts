/** Paper's one ease, for every timed entrance: quick to leave, slow to settle. The same curve is --ease-paper in globals.css. */
export const EASE_PAPER = "cubic-bezier(.2,.7,.2,1)";
/** The one curve for a sheet that leaves: slow to lift, gone at speed. The same curve is --ease-paper-leave in globals.css. */
export const EASE_PAPER_LEAVE = "cubic-bezier(.6,0,.9,.6)";
/** The timed durations that repeat: a card grows, a sheet comes up, the page is carried. */
export const PAPER_CARD_MS = 260;
export const PAPER_SHEET_MS = 320;
export const PAPER_CARRY_MS = 380;
