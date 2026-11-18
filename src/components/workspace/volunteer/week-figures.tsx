"use client";

import Link from "next/link";
import { WeekQuilt } from "@/components/workspace/volunteer/week-quilt";
import { useHour, useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { useFirstLook } from "@/components/workspace/first-look";
import { isBrandNew, nothingWaiting } from "@/lib/first-days";

/**
 * The three numbers a leader's week turns on, each a way into its room: calls waiting,
 * visits planned, requests awaiting a yes. Shown only to those who may open neighbor records.
 */
/** `noted`: the Monday note's one line sits right under the row and already says what is approved and unpaid. */
export function WeekFigures({ noted = false }: { noted?: boolean }) {
  const { data, words } = useWorkspace();
  const churchId = data.church.id;
  // In a first look at the sample the seed's answer stands for both readings.
  const look = useFirstLook();
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId }) ?? (look ? (look.allowed ?? true) : undefined);
  const at = useHour();
  const counts = useQuery(api.drafts.weekNote, allowed && at ? { churchId, at } : "skip") ?? look?.weekNote;
  // Still on their way: the door's paper (door.tsx) waits for them, so it lifts off a room with its figures in.
  if (!counts) return allowed === false ? null : <span hidden data-room-pending="" />;
  // A brand-new group with nothing waiting: three zeros say nothing, and the room's first-week state stands in their place.
  if (isBrandNew(data) && nothingWaiting(counts)) return null;
  // Under a figure, one short line of why it matters today. Only what is waiting gets one.
  const why = words.week.figures;
  const figures = [
    { area: "help-line", label: why.calls, value: counts.callsWaiting, reason: counts.callsWaiting && counts.oldestWaitingDays ? why.oldest(counts.oldestWaitingDays) : "" },
    { area: "visits", label: why.visits, value: counts.visitsPlanned, reason: "" },
    { area: "neighbors", label: why.requests, value: counts.requestsOpen, reason: counts.approvedUnpaid && !noted ? why.toPay(counts.approvedUnpaid) : "" },
  ] as const;
  return (
    <>
    <WeekQuilt />
    <nav className="week-figures paper-rows" aria-label={words.monday.title}>
      {figures.map(({ area, label, value, reason }) => (
        <Link key={area} href={`/app/${area}`}>
          {/* The figure itself, at once: nothing in the workspace counts up, and a figure that changes changes once. */}
          <span className="count-up">{value}</span>
          <span>{label}</span>
          {/* Always there, so the row keeps its height when a reason comes or goes. */}
          <small>{reason}</small>
        </Link>
      ))}
    </nav>
    </>
  );
}
