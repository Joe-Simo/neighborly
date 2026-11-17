import type { Terms } from "../sets";

/**
 * Home visits: the room, choosing a pair, the write-up and the visit sheet.
 * Every sentence is written whole in each language: a line, a line counted by a number, or a line with named
 * places (`{name}`) filled by `fill` (../fill.ts). Nothing is joined from pieces on the screen.
 */
export const en = (t: Terms, place: string) => ({
});

/** Spanish. Written without a native speaker's review; one is still owed. */
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
});
