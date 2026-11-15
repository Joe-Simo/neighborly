"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { api } from "../../../../convex/_generated/api";
import type { LiveArea } from "@/components/workspace/areas";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate, type Words } from "@/lib/words";

type Counts = FunctionReturnType<typeof api.drafts.weekNote>;
type Line = { area: LiveArea; text: string; brief: string };

const day = 86_400_000;
const put = "week-note-put-away";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};
/** Storage can be closed to the page; then the note is simply shown again. */
const stored = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** The Monday that opens the week `now` falls in, on the group's own calendar. */
export function mondayOf(now: number, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  return now - ((["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 7) % 7) * day;
}

/** At most four lines, the most pressing first, each with the room where it is dealt with. */
export function weekLines(text: Words["monday"], counts: Counts): Line[] {
  const calls = [
    text.calls(counts.callsWaiting),
    counts.callsUrgent ? text.urgent(counts.callsUrgent) : "",
    counts.oldestWaitingDays ? text.oldest(counts.oldestWaitingDays) : "",
  ].filter(Boolean).join(" ");
  const all: (Line & { count: number })[] = [
    { count: counts.callsWaiting, area: "help-line", text: calls, brief: text.brief.calls(counts.callsWaiting) },
    { count: counts.requestsOpen, area: "neighbors", text: text.open(counts.requestsOpen), brief: text.brief.open(counts.requestsOpen) },
    { count: counts.approvedUnpaid, area: "treasury", text: text.approved(counts.approvedUnpaid), brief: text.brief.approved(counts.approvedUnpaid) },
    { count: counts.visitsPlanned, area: "visits", text: text.visits(counts.visitsPlanned), brief: text.brief.visits(counts.visitsPlanned) },
    { count: counts.openPlaces, area: "commitments", text: text.places(counts.openPlaces), brief: text.brief.places(counts.openPlaces) },
    { count: counts.away, area: "time-off", text: text.away(counts.away), brief: text.brief.away(counts.away) },
  ];
  return all.filter((line) => line.count > 0).slice(0, 4).map(({ area, text, brief }) => ({ area, text, brief }));
}

/**
 * The week in a few plain sentences, for the people who lead the group. It takes one prop:
 * `brief` when something else on the screen already waits for a yes, so the note is one line.
 * It shows nothing to anyone who may not open neighbor records, and nothing once it has been
 * read, until the next Monday. The sentences are fixed words around counts; none of it was
 * written by the assistant.
 */
export function WeekNote({ brief = false }: { brief?: boolean }) {
  const { data, now } = useWorkspace();
  const churchId = data.church.id;
  const monday = mondayOf(now, data.church.timeZone);
  const week = `${churchId}:${new Intl.DateTimeFormat("en-CA", { timeZone: data.church.timeZone }).format(monday)}`;
  const away = useSyncExternalStore(subscribe, () => stored(put) === week, () => true);
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const counts = useQuery(api.drafts.weekNote, allowed && !away ? { churchId } : "skip");
  if (!counts || away) return null;
  return (
    <WeekNoteView
      counts={counts}
      monday={monday}
      brief={brief}
      onDone={() => {
        try {
          window.localStorage.setItem(put, week);
        } catch {
          return;
        }
        listeners.forEach((listener) => listener());
      }}
    />
  );
}

const quietLink = "min-h-11 inline-flex items-center border-0 bg-transparent p-0 text-[17px] !text-[var(--live-accent)] !underline decoration-[#b9c4b0] underline-offset-4 hover:decoration-current cursor-pointer";

export function WeekNoteView({ counts, monday, brief, onDone }: { counts: Counts; monday: number; brief: boolean; onDone: () => void }) {
  const { data, words } = useWorkspace();
  const [open, setOpen] = useState(false);
  const text = words.monday;
  const lines = weekLines(text, counts);
  if (brief && !open) {
    if (!lines.length) return null;
    return (
      <p className="mb-7 flex flex-wrap items-baseline gap-x-3 text-[17px] leading-snug text-[var(--live-ink)]">
        <span>
          <strong className="font-[650]">{text.brief.label}:</strong> {lines.slice(0, 3).map((line) => line.brief).join(", ")}.
        </span>
        <button type="button" className={quietLink} onClick={() => setOpen(true)}>
          {text.read}
        </button>
      </p>
    );
  }
  return (
    <section className="help-sheet after:!hidden" aria-labelledby="week-note">
      <p className="help-sheet-label !text-[var(--live-muted)]">
        {formatDate(words.locale, monday, { timeZone: data.church.timeZone, weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h2 id="week-note">{text.title}</h2>
      {lines.length ? (
        <ul className="mt-5 mb-4 grid list-none gap-3 p-0 text-[19px] leading-snug text-[var(--live-ink)]">
          {lines.map((line) => (
            <li key={line.area} className="flex flex-wrap items-baseline gap-x-4">
              <span>{line.text}</span>
              <Link href={`/app/${line.area}`} className={`${quietLink} min-[761px]:!min-h-0`}>
                {words.menu[line.area]}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="help-why !text-[19px]">{text.quiet}</p>
      )}
      <p className="!max-w-none text-[15px]">{text.origin}</p>
      <button type="button" className={quietLink} onClick={onDone}>
        {text.done}
      </button>
    </section>
  );
}
