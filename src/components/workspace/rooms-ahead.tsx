"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueries } from "convex/react";
import { useHour } from "@/components/workspace/query";
import { api } from "../../../convex/_generated/api";
import type { LiveWorkspaceData } from "@/components/workspace/types";
import { ROOM_WHOLE } from "@/lib/room-whole";
import { whenIdle } from "@/lib/idle";

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

/** The rooms whose head button a sample visitor's warmed answers decide, by the address of their link. */
const SAMPLE_AHEAD = { "help-line": "drafts", visits: "board", treasury: "payable" } as const;
type SampleAhead = (typeof SAMPLE_AHEAD)[keyof typeof SAMPLE_AHEAD];
/** How long a sample visitor rests on This week before its neighbours' answers are asked for. */
const WEEK_REST = 4000;

/**
 * A sample visitor is shared by everyone looking around, so every answer warmed for them is read again for all of
 * them each time anyone saves. So for them the ledger and the years are never warmed (their rooms wait for their own
 * answer and are still shown whole), and the rest only once they have rested on This week, or point at or focus a
 * room's link.
 */
function useSampleAhead(sample: boolean, area: string): ReadonlySet<SampleAhead> {
  const [wanted, setWanted] = useState<ReadonlySet<SampleAhead>>(() => new Set());
  const want = useCallback((more: SampleAhead[]) => setWanted((had) => (more.every((one) => had.has(one)) ? had : new Set([...had, ...more]))), []);
  useEffect(() => {
    if (!sample || area !== "week") return;
    let calledOff = () => {};
    const rest = window.setTimeout(() => (calledOff = whenIdle(() => want(Object.values(SAMPLE_AHEAD)), 2000)), WEEK_REST);
    return () => { window.clearTimeout(rest); calledOff(); };
  }, [sample, area, want]);
  useEffect(() => {
    if (!sample) return;
    const pointed = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href^='/app/']") : null;
      const room = link?.pathname.split("/")[2];
      if (room && room in SAMPLE_AHEAD) want([SAMPLE_AHEAD[room as keyof typeof SAMPLE_AHEAD]]);
    };
    document.addEventListener("pointerover", pointed, { passive: true });
    document.addEventListener("focusin", pointed);
    return () => { document.removeEventListener("pointerover", pointed); document.removeEventListener("focusin", pointed); };
  }, [sample, want]);
  return wanted;
}

export function RoomsAhead({ data, sample, area }: { data: LiveWorkspaceData; sample: boolean; area: string }) {
  const churchId = data.church.id;
  const role = data.people.find((person) => person.id === data.user.id)?.role;
  const leads = role === "owner" || role === "coordinator";
  // The same hour the rooms ask with, or the question would be a different one and nothing would be shared.
  const at = useHour();
  const roomIn = useSyncExternalStore(listenForFirstRoom, firstRoomIn, () => false);
  const sampleWants = useSampleAhead(sample && leads, area);
  const asked = useMemo(() => {
    if (!leads || !at || !roomIn) return {};
    const ahead: Parameters<typeof useQueries>[0] = {
      drafts: { query: api.assistance.drafts, args: { churchId } },
      board: { query: api.visits.board, args: { churchId, at } },
      payable: { query: api.treasury.payable, args: { churchId } },
    };
    if (sample) return Object.fromEntries(Object.entries(ahead).filter(([name]) => sampleWants.has(name as SampleAhead)));
    return {
      ...ahead,
      years: { query: api.reports.years, args: { churchId, at } },
      allowed: { query: api.access.canOpenNeighborRecords, args: { churchId } },
      ledger: { query: api.treasury.ledger, args: { churchId } },
    };
  }, [churchId, leads, at, roomIn, sample, sampleWants]);
  useQueries(asked);
  return null;
}
