"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import type { Words } from "@/lib/words";

type Counts = FunctionReturnType<typeof api.drafts.weekNote>;

/**
 * The week in a few plain sentences, for the people who lead the group. It takes no props
 * and shows nothing to anyone who may not open neighbor records. The sentences are fixed
 * words around counts; nothing here was written by the assistant.
 */
export function WeekNote() {
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const counts = useQuery(api.drafts.weekNote, allowed ? { churchId } : "skip");
  return counts ? <WeekNoteView counts={counts} /> : null;
}

/** One line per subject, in the order a president would ask about them. */
export function weekLines(text: Words["monday"], counts: Counts): string[] {
  const calls = counts.callsWaiting
    ? [
        text.calls(counts.callsWaiting),
        counts.callsUrgent ? text.urgent(counts.callsUrgent) : "",
        counts.oldestWaitingDays ? text.oldest(counts.oldestWaitingDays) : "",
      ].filter(Boolean).join(" ")
    : "";
  return [
    calls,
    counts.requestsOpen ? text.open(counts.requestsOpen) : "",
    counts.approvedUnpaid ? text.approved(counts.approvedUnpaid) : "",
    counts.visitsPlanned ? text.visits(counts.visitsPlanned) : "",
    counts.openPlaces ? text.places(counts.openPlaces) : "",
    counts.away ? text.away(counts.away) : "",
  ].filter(Boolean);
}

export function WeekNoteView({ counts }: { counts: Counts }) {
  const { words } = useWorkspace();
  const lines = weekLines(words.monday, counts);
  return (
    <section className="help-sheet" aria-labelledby="week-note">
      <h2 id="week-note">{words.monday.title}</h2>
      {lines.length ? (
        <ul className="mt-4 mb-5 grid list-none gap-2.5 p-0 text-[19px] leading-snug text-[var(--live-ink)]">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="help-why text-[19px]">{words.monday.quiet}</p>
      )}
      <p className="!mb-0 !max-w-none text-[15px]">{words.monday.origin}</p>
    </section>
  );
}
