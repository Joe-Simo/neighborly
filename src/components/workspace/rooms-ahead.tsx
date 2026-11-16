"use client";

import { useMemo } from "react";
import { useQueries } from "convex/react";
import { useHour } from "@/components/workspace/query";
import { api } from "../../../convex/_generated/api";
import type { LiveWorkspaceData } from "@/components/workspace/types";

/**
 * Asks ahead for what decides a room's head button, so the button arrives with its heading and in
 * its final style, not a frame or two after. Convex answers a question already being asked from
 * what it holds, so the room reads it on its first frame. Asked only for those who lead, and in the
 * way that cannot fail the page: a refusal is an answer nobody reads.
 */
export function RoomsAhead({ data }: { data: LiveWorkspaceData }) {
  const churchId = data.church.id;
  const role = data.people.find((person) => person.id === data.user.id)?.role;
  const leads = role === "owner" || role === "coordinator";
  // The same hour the rooms ask with, or the question would be a different one and nothing would be shared.
  const at = useHour();
  const asked = useMemo(() => {
    const ahead: Parameters<typeof useQueries>[0] = {
      drafts: { query: api.assistance.drafts, args: { churchId } },
      board: { query: api.visits.board, args: { churchId, at } },
      years: { query: api.reports.years, args: { churchId, at } },
      allowed: { query: api.access.canOpenNeighborRecords, args: { churchId } },
      ledger: { query: api.treasury.ledger, args: { churchId } },
      payable: { query: api.treasury.payable, args: { churchId } },
    };
    return leads && at ? ahead : {};
  }, [churchId, leads, at]);
  useQueries(asked);
  return null;
}
