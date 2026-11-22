import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

/** This week of the sample as the seed has it: public, read from no row, and holding nothing a visitor typed. */
export type FirstRoom = NonNullable<FunctionReturnType<typeof api.demo.firstRoom>>;

const HOUR = 3_600_000;
let asked: { hour: number; answer: Promise<FirstRoom | null>; here?: FirstRoom | null } | null = null;

/**
 * Asks for the sample's first room before the visitor arrives at it: once the sample card nears the window, so the room
 * is in hand at the press and is drawn while the real sign-in is still on its way. One request per page view and hour.
 * It needs no session and sends nothing about the visitor. Without an answer the room simply waits for sign-in, as before.
 */
export function askFirstRoom() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const hour = Math.floor(Date.now() / HOUR) * HOUR;
  if (!url || asked?.hour === hour) return;
  // The backend's client is loaded only now, so the home page does not carry it for visitors who never come near the card.
  // So is the function reference: convex/_generated/api is convex/server's anyApi, which pulls in its validators.
  const answer = Promise.all([import("convex/browser"), import("../../convex/_generated/api")])
    .then(([{ ConvexHttpClient }, { api }]) => new ConvexHttpClient(url).query(api.demo.firstRoom, { at: hour }))
    .catch(() => null);
  const asking: NonNullable<typeof asked> = { hour, answer };
  asked = asking;
  // Kept as it stands once it is here, so the room can be drawn from it in its very first pass, with no wait for a promise.
  void answer.then((room) => (asking.here = room));
  // The room's head picture is asked for with it, in the cut the room will show, so it is here when the room is laid.
  void import("@/components/workspace/relief-ahead").then(({ fetchAhead }) => fetchAhead(["week"])).catch(() => {});
}

/** The answer if it is already here: a room, null for none to be had, undefined while it is on its way, was never asked for, or is from an earlier hour. */
export function firstRoomHere() {
  // Only an answer asked for this hour: an older one is asked for again (askFirstRoom), never drawn.
  return asked?.hour === Math.floor(Date.now() / HOUR) * HOUR ? asked.here : undefined;
}

/** The answer on its way or already here, for the workspace to draw from; undefined if it was never asked for. */
export function firstRoom() {
  return asked?.answer;
}
