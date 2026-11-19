"use client";

import { useHour, useQuery } from "@/components/workspace/query";
import { useFirstLook } from "@/components/workspace/first-look";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../../../../convex/_generated/api";
import type { LiveArea } from "@/components/workspace/areas";
import { useWorkspace } from "@/components/workspace/context";
import { WeekFigures } from "@/components/workspace/volunteer/week-figures";
import { isBrandNew } from "@/lib/first-days";
import { dateFormatter, formatDate, type Words } from "@/lib/words";

type Counts = FunctionReturnType<typeof api.drafts.weekNote>;
/** A line is said in parts so the one part that rests on the assistant's reading can be shown in plum. */
type Line = { area: LiveArea; parts: { text: string; assistant?: true }[]; brief: string };

const day = 86_400_000;
const put = "week-note-put-away";
/** The counts the note last showed, numbers only, so its place can be kept at the right size while this visit's are on their way. */
const kept = "week-note-last";
/** A first visit keeps room for a full note, which is what a busy week has. */
const full: Counts = { callsWaiting: 2, callsFirstByAssistant: 1, callsFirstByRules: 0, callsFirstByPerson: 1, oldestWaitingDays: 2, visitsPlanned: 2, requestsOpen: 2, approvedUnpaid: 2, approvedUnpaidCents: 0, openPlaces: 2, away: 2 };
function remembered(raw: string | null): Counts {
  try {
    const last: unknown = JSON.parse(raw ?? "");
    if (!last || typeof last !== "object") return full;
    const numbers = Object.fromEntries(Object.entries(last).filter(([name, value]) => name in full && typeof value === "number"));
    return Object.keys(numbers).length === Object.keys(full).length ? (numbers as Counts) : full;
  } catch {
    return full;
  }
}
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
  const name = dateFormatter("en-US", { timeZone, weekday: "short" }).format(now);
  return now - ((["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 7) % 7) * day;
}

/** At most four lines unless told otherwise, the most pressing first, each with the room where it is dealt with. */
export function weekLines(text: Words["monday"], counts: Counts, most = 4): Line[] {
  const calls: Line["parts"] = [
    { text: text.calls(counts.callsWaiting) },
    ...(counts.callsFirstByAssistant ? [{ text: text.firstByAssistant(counts.callsFirstByAssistant), assistant: true as const }] : []),
    // An older backend counts no calls put first by the rules alone.
    ...(counts.callsFirstByRules ? [{ text: text.firstByRules(counts.callsFirstByRules) }] : []),
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
  return all.filter((line) => line.count > 0).slice(0, most).map(({ area, parts, brief }) => ({ area, parts, brief }));
}

/**
 * The week in a few plain sentences, for the people who lead the group. It takes one prop:
 * `brief` when something else on the screen already waits for a yes, so the note is one line.
 * It shows nothing to anyone who may not open neighbor records, and nothing once it has been
 * read, until the next Monday, and nothing in a week with nothing waiting. The sentences are fixed words around counts; none of it was
 * written by the assistant.
 */
export function WeekNote({ brief = false }: { brief?: boolean }) {
  const { data, now, isOwner } = useWorkspace();
  const churchId = data.church.id;
  const monday = mondayOf(now, data.church.timeZone);
  // The sample is laid anew each night under a new id, and is first drawn before any id is known (first-look.tsx):
  // its note is put away under one name, so it stays away for the week through both.
  const week = `${data.church.sample ? "sample" : churchId}:${dateFormatter("en-CA", { timeZone: data.church.timeZone }).format(monday)}`;
  const away = useSyncExternalStore(subscribe, () => stored(put) === week, () => true);
  const look = useFirstLook();
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId }) ?? (look ? (look.allowed ?? true) : undefined);
  const at = useHour();
  const counts = useQuery(api.drafts.weekNote, allowed && !away && at ? { churchId, at } : "skip") ?? (away ? undefined : look?.weekNote);
  const last = useSyncExternalStore(subscribe, () => stored(kept), () => null);
  useEffect(() => {
    if (!counts) return;
    try {
      window.localStorage.setItem(kept, JSON.stringify(counts));
    } catch {
      return;
    }
  }, [counts]);
  if (allowed === false) return null;
  // Read and put away: the three figures stay, on their own, until next Monday's note.
  if (away) return <WeekFigures />;
  // Counts on their way: for those who lead, the note's place is kept in paper at the size it last had,
  // so nothing below it moves when it arrives. No remembered number is shown, only its shape.
  // The door's paper (door.tsx) waits for them too: `data-room-pending`.
  // A brand-new group has had no note: no place is kept for one, so the first-week state does not move when the counts arrive.
  if (!counts) return (isOwner || data.canCoordinate) && !isBrandNew(data) ? <><span hidden data-room-pending="" /><WeekNoteView key="waiting" counts={remembered(last)} monday={monday} brief={brief} waiting onDone={() => {}} /></> : <span hidden data-room-pending="" />;
  // An older backend answers without saying who put a call first; the note waits for the one that does.
  if (!("callsFirstByAssistant" in counts)) return null;
  return (
    <WeekNoteView
      // A new sheet, not the kept place filled in: it is laid down with its words.
      key="note"
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

const quietLink = "min-h-11 inline-flex items-center border-0 bg-transparent p-0 px-1.5 -mx-1.5 text-[17px] !text-[var(--live-accent)] !underline decoration-[#b9c4b0] underline-offset-4 hover:decoration-current active:decoration-2 active:decoration-current cursor-pointer";
/** While waiting, the note keeps its room unseen: no bars, no empty card. It arrives with its words or not yet. */
const held = "invisible";

function WeekNoteView({ counts, monday, brief, waiting = false, onDone }: { counts: Counts; monday: number; brief: boolean; waiting?: boolean; onDone: () => void }) {
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
  if (!lines.length) return waiting ? null : <WeekFigures />;
  if (brief && !open) {
    // The figures come first so they stay on a phone's first screen; the line under them says only what they do not.
    const rest = weekLines(text, counts, 6).filter((line) => !["help-line", "visits", "neighbors"].includes(line.area));
    return (
      <>
        {!waiting && <WeekFigures noted />}
        <p className={`!-mt-4 !mb-8 text-[15px] leading-snug text-[var(--live-muted)] ${waiting ? held : "paper-rise"}`} aria-hidden={waiting || undefined} inert={waiting}>
          <span>
            <strong className="font-[650] text-[var(--live-ink)]">{text.brief.label}{rest.length ? ":" : ""}</strong>{rest.length ? ` ${rest.map((line) => line.brief).join(", ")}.` : ""}
          </span>{" "}
          {/* Read follows the line's last words, as a sentence would, rather than wrapping alone onto a row of its own. */}
          <button type="button" className={`${quietLink} ml-1 -my-3`} aria-label={text.readLabel} data-opens="" onClick={() => setOpen(true)}>
            {text.read}
          </button>
        </p>
      </>
    );
  }
  // The sheet leads with the three figures, each a way into its room. Under them it says only what a
  // figure cannot: who put a call first and how long the oldest has waited, then what else is waiting.
  const figures = [
    { area: "help-line", label: words.week.figures.calls, value: counts.callsWaiting },
    { area: "visits", label: words.week.figures.visits, value: counts.visitsPlanned },
    { area: "neighbors", label: words.week.figures.requests, value: counts.requestsOpen },
  ] as const;
  const callDetail = lines.find((line) => line.area === "help-line")?.parts.slice(1) ?? [];
  const also = weekLines(text, counts, 6).filter((line) => !figures.some((figure) => figure.area === line.area));
  return (
    <div className={`grid transition-[grid-template-rows,opacity,translate] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${leaving ? "-translate-y-2 grid-rows-[0fr] overflow-hidden opacity-0" : "grid-rows-[1fr]"} ${waiting ? held : ""}`} aria-hidden={waiting || undefined} inert={waiting}>
      <div className="min-h-0">
        <section className="help-sheet after:!hidden" aria-labelledby={waiting ? undefined : "week-note"}>
          <p className={`help-sheet-label !text-[var(--live-muted)] ${waiting ? "invisible" : ""}`}>
            {text.weekOf(formatDate(words.locale, monday, { timeZone: data.church.timeZone, month: "long", day: "numeric" }))}
          </p>
          <h2 id={waiting ? undefined : "week-note"} className={waiting ? held : undefined}>
            <span>{text.title}</span>
          </h2>
          <div className={`week-figures !mt-6 !mb-0 !border-y-0 gap-y-4 ${waiting ? "" : "paper-rows"}`}>
            {figures.map(({ area, label, value }) => (
              <Link key={area} href={`/app/${area}`} className={`!py-0 ${waiting ? held : ""}`}>
                <span className="count-up">{value}</span>
                <span>{label}</span>
              </Link>
            ))}
            {callDetail.length > 0 && (
              <p className={`col-span-3 !m-0 !max-w-[34ch] text-[17px] leading-snug !text-[var(--live-ink)] min-[600px]:!max-w-none ${waiting ? held : ""}`}>
                <span>
                  {callDetail.map((part, index) => (
                    <span key={part.text} className={part.assistant ? "text-[var(--help-plum)]" : undefined}>
                      {index > 0 && " "}
                      {part.text}
                    </span>
                  ))}
                </span>
              </p>
            )}
          </div>
          {also.length > 0 && (
            <ul className={`mt-7 mb-0 grid list-none gap-x-10 gap-y-3 border-t border-[#e6e2d2] p-0 pt-5 text-[17px] leading-snug text-[var(--live-ink)] min-[761px]:grid-cols-3 ${waiting ? "" : "paper-rows"}`}>
              {also.map((line) => (
                <li key={line.area} className={`flex flex-wrap items-baseline gap-x-3 min-[761px]:block ${waiting ? held : ""}`}>
                  <span>{line.parts.map((part) => part.text).join(" ")}</span>
                  <Link href={`/app/${line.area}`} className={`${quietLink} min-[761px]:!min-h-10 min-[761px]:-mt-0.5 min-[761px]:-mb-2 min-[761px]:!flex min-[761px]:w-fit`}>
                    {words.menu[line.area]}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className={`mt-6 flex flex-wrap items-baseline justify-between gap-x-6 ${waiting ? "invisible" : ""}`}>
            <p className="!m-0 !max-w-none text-[15px]">{text.origin}</p>
            <button type="button" className={`${quietLink} !text-[15px]`} onClick={putAway}>
              {text.done}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
