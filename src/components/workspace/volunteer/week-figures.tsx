"use client";

import Link from "next/link";
import { useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { CountUp } from "@/components/workspace/primitives";

/**
 * The three numbers a leader's week turns on, each a way into its room: calls waiting,
 * visits planned, requests awaiting a yes. Shown only to those who may open neighbor records.
 */
/** `noted`: the Monday note's one line sits right under the row and already says what is approved and unpaid. */
export function WeekFigures({ noted = false }: { noted?: boolean }) {
  const { data, words } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const counts = useQuery(api.drafts.weekNote, allowed ? { churchId } : "skip");
  if (!counts) return null;
  // Under a figure, one short line of why it matters today. Only what is waiting gets one.
  const why = words.week.figures;
  const figures = [
    { area: "help-line", label: why.calls, value: counts.callsWaiting, reason: counts.callsWaiting && counts.oldestWaitingDays ? why.oldest(counts.oldestWaitingDays) : "" },
    { area: "visits", label: why.visits, value: counts.visitsPlanned, reason: "" },
    { area: "neighbors", label: why.requests, value: counts.requestsOpen, reason: counts.approvedUnpaid && !noted ? why.toPay(counts.approvedUnpaid) : "" },
  ] as const;
  return (
    <nav className="week-figures paper-rows" aria-label={words.monday.title}>
      {figures.map(({ area, label, value, reason }) => (
        <Link key={area} href={`/app/${area}`}>
          <CountUp value={value} />
          <span>{label}</span>
          {/* Always there, so the row keeps its height when a reason comes or goes. */}
          <small>{reason}</small>
        </Link>
      ))}
    </nav>
  );
}
