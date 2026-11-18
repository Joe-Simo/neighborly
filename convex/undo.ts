import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * How long an act can be taken back from its saved line. The line itself goes after ten seconds, but stays while a
 * hand or the keyboard is on it, so the server allows two minutes; after that a change is made the room's usual way.
 */
export const UNDO_MS = 2 * 60 * 1000;

/** Only the member who took the act, and only while its line can still be up, may take it back this way. */
export function mayUndo(taken: { by: Id<"memberships"> | undefined; at: number | undefined }, member: Id<"memberships">, now: number) {
  if (taken.by !== member || taken.at === undefined || now - taken.at > UNDO_MS) throw new ConvexError("This can no longer be undone here.");
}
