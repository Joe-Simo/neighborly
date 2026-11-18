"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQueries } from "convex/react";
import { useHour } from "@/components/workspace/query";
import { api } from "../../../convex/_generated/api";
import type { LiveWorkspaceData } from "@/components/workspace/types";
import { ROOM_WHOLE } from "@/lib/room-whole";

/**
 * Asks ahead for what decides a room's head button, so the button arrives with its heading and in
 * its final style, not a frame or two after. Convex answers a question already being asked from
 * what it holds, so the room reads it on its first frame. Asked only for those who lead, and in the
 * way that cannot fail the page: a refusal is an answer nobody reads. Asked once the first room is shown whole, so these
 * answers (the ledger alone is over 100 KB) never travel and parse on a phone while the first room waits on its own.
 */
// Once any room has been shown whole on this page the questions stay asked, also while a later room is arriving.
let firstRoomSeen = false;
const firstRoomIn = () => (firstRoomSeen ||= document.querySelector(".live-app[data-room-shown]") !== null);
function listenForFirstRoom(changed: () => void) {
  window.addEventListener(ROOM_WHOLE, changed);
  return () => window.removeEventListener(ROOM_WHOLE, changed);
}

export function RoomsAhead({ data }: { data: LiveWorkspaceData }) {
  const churchId = data.church.id;
  const role = data.people.find((person) => person.id === data.user.id)?.role;
  const leads = role === "owner" || role === "coordinator";
  // The same hour the rooms ask with, or the question would be a different one and nothing would be shared.
  const at = useHour();
  const roomIn = useSyncExternalStore(listenForFirstRoom, firstRoomIn, () => false);
  const asked = useMemo(() => {
    const ahead: Parameters<typeof useQueries>[0] = {
      drafts: { query: api.assistance.drafts, args: { churchId } },
      board: { query: api.visits.board, args: { churchId, at } },
      years: { query: api.reports.years, args: { churchId, at } },
      allowed: { query: api.access.canOpenNeighborRecords, args: { churchId } },
      ledger: { query: api.treasury.ledger, args: { churchId } },
      payable: { query: api.treasury.payable, args: { churchId } },
    };
    return leads && at && roomIn ? ahead : {};
  }, [churchId, leads, at, roomIn]);
  useQueries(asked);
  return null;
}
