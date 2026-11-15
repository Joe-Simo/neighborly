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
/** A line is said in parts so the one part that rests on the assistant's reading can be shown in plum. */
type Line = { area: LiveArea; parts: { text: string; assistant?: true }[]; brief: string };

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
  const calls: Line["parts"] = [
    { text: text.calls(counts.callsWaiting) },
    ...(counts.callsFirstByAssistant ? [{ text: text.firstByAssistant(counts.callsFirstByAssistant), assistant: true as const }] : []),
    ...(counts.callsFirstByPerson ? [{ text: text.firstByPerson(counts.callsFirstByPerson) }] : []),
    ...(counts.oldestWaitingDays ? [{ text: text.oldest(counts.oldestWaitingDays) }] : []),
  ];
  const all: (Line & { count: number })[] = [
    { count: counts.callsWaiting, area: "help-line", parts: calls, brief: text.brief.calls(counts.callsWaiting) },
    { count: counts.requestsOpen, area: "neighbors", parts: [{ text: text.open(counts.requestsOpen) }], brief: text.brief.open(counts.requestsOpen) },
    { count: counts.approvedUnpaid, area: "treasury", parts: [{ text: text.approved(counts.approvedUnpaid) }], brief: text.brief.approved(counts.approvedUnpaid) },
    { count: counts.visitsPlanned, area: "visits", parts: [{ text: text.visits(counts.visitsPlanned) }], brief: text.brief.visits(counts.visitsPlanned) },
    { count: counts.openPlaces, area: "commitments", parts: [{ text: text.places(counts.openPlaces) }], brief: text.brief.places(counts.openPlaces) },
    { count: counts.away, area: "time-off", parts: [{ text: text.away(counts.away) }], brief: text.brief.away(counts.away) },
  ];
  return all.filter((line) => line.count > 0).slice(0, 4).map(({ area, parts, brief }) => ({ area, parts, brief }));
}

/**
 * The week in a few plain sentences, for the people who lead the group. It takes one prop:
 * `brief` when something else on the screen already waits for a yes, so the note is one line.
 * It shows nothing to anyone who may not open neighbor records, and nothing once it has been
 * read, until the next Monday, and nothing in a week with nothing waiting. The sentences are fixed words around counts; none of it was
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
  // An older backend answers without saying who put a call first; the note waits for the one that does.
  if (!counts || away || !("callsFirstByAssistant" in counts)) return null;
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
  // "Done reading" puts the sheet away like paper: it lifts, thins and the page closes over where it lay.
  const [leaving, setLeaving] = useState(false);
  const putAway = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return onDone();
    setLeaving(true);
    window.setTimeout(onDone, 320);
  };
  const text = words.monday;
  const lines = weekLines(text, counts);
  if (!lines.length) return null;
  if (brief && !open) {
    return (
      <p className="paper-rise mb-7 flex flex-wrap items-baseline gap-x-3 text-[17px] leading-snug text-[var(--live-ink)]">
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
    <div className={`grid transition-[grid-template-rows,opacity,translate] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${leaving ? "-translate-y-2 grid-rows-[0fr] overflow-hidden opacity-0" : "grid-rows-[1fr]"}`}>
      <div className="min-h-0">
        <section className="help-sheet after:!hidden" aria-labelledby="week-note">
          <p className="help-sheet-label !text-[var(--live-muted)]">
            {formatDate(words.locale, monday, { timeZone: data.church.timeZone, weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h2 id="week-note">{text.title}</h2>
          {/* From 761px each line keeps a 60-character measure and its room sits in one steady column on the right. */}
          <ul className="paper-rows mt-5 mb-5 grid list-none gap-3 p-0 text-[19px] leading-snug text-[var(--live-ink)] min-[761px]:gap-0">
            {lines.map((line) => (
              <li key={line.area} className="flex flex-wrap items-baseline gap-x-4 min-[761px]:grid min-[761px]:grid-cols-[minmax(0,60ch)_auto] min-[761px]:justify-between min-[761px]:gap-x-10 min-[761px]:border-t min-[761px]:border-[#e6e2d2] min-[761px]:py-3.5 min-[761px]:first:border-t-0 min-[761px]:first:pt-0">
                <span>
                  {line.parts.map((part, index) => (
                    <span key={part.text} className={part.assistant ? "text-[var(--help-plum)]" : undefined}>
                      {index > 0 && " "}
                      {part.text}
                    </span>
                  ))}
                </span>
                <Link href={`/app/${line.area}`} className={`${quietLink} min-[761px]:!min-h-0`}>
                  {words.menu[line.area]}
                </Link>
              </li>
            ))}
          </ul>
          <p className="!max-w-none text-[15px]">{text.origin}</p>
          <button type="button" className={quietLink} onClick={putAway}>
            {text.done}
          </button>
        </section>
      </div>
    </div>
  );
}
