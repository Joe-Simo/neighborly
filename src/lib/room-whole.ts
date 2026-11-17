/**
 * Sent on the window in the frame a room is shown whole, after the page says so (`.live-app[data-room-shown]`) and
 * before that frame is painted. A listener that arrives late reads the mark instead: the two never disagree.
 * Kept apart from the room's own code so the home page's card can listen without carrying the workspace with it.
 */
export const ROOM_WHOLE = "kh-room-whole";
