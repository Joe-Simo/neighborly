"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { CountUp } from "@/components/workspace/primitives";

/**
 * The three numbers a leader's week turns on, each a way into its room: calls waiting,
 * visits planned, requests awaiting a yes. Shown only to those who may open neighbor records.
 */
export function WeekFigures() {
  const { data, words } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const counts = useQuery(api.drafts.weekNote, allowed ? { churchId } : "skip");
  if (!counts) return null;
  const figures = [
    { area: "help-line", label: words.week.figures.calls, value: counts.callsWaiting },
    { area: "visits", label: words.week.figures.visits, value: counts.visitsPlanned },
    { area: "neighbors", label: words.week.figures.requests, value: counts.requestsOpen },
  ] as const;
  return (
    <nav className="week-figures paper-rows" aria-label={words.monday.title}>
      {figures.map(({ area, label, value }) => (
        <Link key={area} href={`/app/${area}`}>
          <CountUp value={value} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
