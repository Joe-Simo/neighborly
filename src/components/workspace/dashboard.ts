"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries, type RequestForQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { forgetKeptRoom } from "@/lib/kept-room";

type Dashboard = FunctionReturnType<typeof api.workspace.dashboard>;

/**
 * The open conference's room data, asked for as early as it honestly can be.
 * - The conference last opened on this device is asked for the moment the account is known, beside the question of
 *   which conferences this person belongs to, not after it. A remembered conference that is gone (the sample is laid
 *   anew each night) answers with an error, which is set aside until the list arrives and names the right one.
 * - Through the sample door (the link was pressed: enterSample) there is one conference, so the room is asked for at
 *   once without naming it, and kept that way: changing the question would read it all again.
 * useQueries resubscribes whenever it is handed a new object, so the question is built once per real change.
 */
/**
 * Which conference the first questions name, before the list of this person's conferences has arrived: the one last
 * opened on this device, or, through the sample door, none (the backend answers for the account's one conference, and
 * the question is kept that way). Once the list names one, that one. `null` while nothing can be asked yet.
 */
export function useFirstChurch({
  churchId,
  enterSample,
  ready,
  listing,
}: {
  /** The conference the list names: the one chosen, else the first. */
  churchId: Id<"churches"> | undefined;
  enterSample: boolean;
  /** The account is known to the backend. */
  ready: boolean;
  /** The list of this person's conferences has not arrived yet. */
  listing: boolean;
}): { churchId?: Id<"churches"> } | null {
  const [remembered] = useState(readRememberedChurch);
  const askedChurch = churchId ?? (ready && listing ? remembered : undefined);
  useEffect(() => {
    if (churchId) rememberChurch(churchId);
  }, [churchId]);
  const [doorAsked] = useState(enterSample);
  return useMemo(() => (doorAsked && ready ? {} : askedChurch ? { churchId: askedChurch } : null), [doorAsked, ready, askedChurch]);
}

export function useDashboard({
  churchId,
  enterSample,
  ready,
  listing,
  sampleVisitor,
}: {
  /** The conference the list names: the one chosen, else the first. */
  churchId: Id<"churches"> | undefined;
  enterSample: boolean;
  /** The account is known to the backend. */
  ready: boolean;
  /** The list of this person's conferences has not arrived yet. */
  listing: boolean;
  sampleVisitor: boolean | undefined;
}) {
  const asked = useFirstChurch({ churchId, enterSample, ready, listing });
  const [doorAsked] = useState(enterSample);
  const askedChurch = asked?.churchId;
  const queries = useMemo(
    (): RequestForQueries => (asked ? { dashboard: { query: api.workspace.dashboard, args: asked } } : {}),
    [asked],
  );
  const reading = useQueries(queries).dashboard as Dashboard | Error | undefined;
  // A failure for the conference the list names is a real one, and goes to the room's error state as before.
  if (reading instanceof Error && (doorAsked ? sampleVisitor === true : askedChurch === churchId)) {
    // Access refused: a room kept on the device for this conference (lib/kept-room.ts) is let go with it.
    forgetKeptRoom();
    throw reading;
  }
  return reading instanceof Error || (churchId && reading?.church.id !== churchId) ? undefined : reading;
}

const churchKey = "kindhelps.church";
function readRememberedChurch() {
  try {
    return (window.localStorage.getItem(churchKey) as Id<"churches"> | null) ?? undefined;
  } catch {
    return undefined;
  }
}
function rememberChurch(id: Id<"churches">) {
  try {
    window.localStorage.setItem(churchKey, id);
  } catch {
    // Without it the next visit asks for the conference after the list, as before.
  }
}
