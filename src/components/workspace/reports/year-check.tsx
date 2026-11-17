"use client";

import { useWaited } from "@/lib/use-waited";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formatDate, type Words } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import { money } from "@/components/workspace/reports/lines";

export type YearCheckResult = FunctionReturnType<typeof api.drafts.checkYear>;
export type FlaggedRecords = FunctionReturnType<typeof api.reports.flagged>;
type Flag = YearCheckResult["flags"][number];

/** The sheet while the year is being read: it lies where the verdict will, so nothing moves when the verdict arrives. */
export function YearChecking({ words, requests, visits }: { words: Words; requests: number; visits: number }) {
  const text = { ...words.yearCheck, ...words.rooms.reports.check };
  const sheet = useRef<HTMLElement>(null);
  // A wait is one still ochre ring after 400ms: nothing turns or pulses.
  const waited = useWaited(true);
  useEffect(() => {
    sheet.current?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  return (
    <section ref={sheet} className="help-sheet report-check paper-rest" aria-busy="true" role="status" data-reading="">
      <p className="help-sheet-label">{text.title}</p>
      <h2>{text.reading}<span className="report-reading" aria-hidden="true" data-waited={waited ? "" : undefined} /></h2>
      <p>{fill(text.readingWhat, { requests: text.requests(requests), visits: text.visits(visits) })}</p>
    </section>
  );
}

/**
 * What the check before sending found, on the screen's one sheet. Lines the assistant read are in plum;
 * every record is said in a line and opens so a person can settle it. Nothing here changes a record.
 */
export function YearCheck({
  words,
  result,
  records,
  checked,
  timeZone,
  onClose,
}: {
  /** The words in the reader's own language. */
  words: Words;
  result: YearCheckResult;
  /** What each flagged record is. Still loading when left out. */
  records?: FlaggedRecords;
  /** What was looked over, and when. */
  checked: { requests: number; visits: number; at: number };
  timeZone: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const groups = new Map<string, Flag[]>();
  for (const flag of result.flags) groups.set(`${flag.kind}-${flag.source}`, [...(groups.get(`${flag.kind}-${flag.source}`) ?? []), flag]);
  const text = { ...words.yearCheck, ...words.rooms.reports.check };
  // One record said in a line, whole for each thing that can have happened to a request.
  const happened: Record<string, string> = text.requestOn;
  // The kinds of help in the reader's language.
  const { kinds } = words;
  const day = (at: number) => formatDate(words.locale, at, { month: "short", day: "numeric", timeZone });

  const line = ({ record }: Flag) => {
    if (record.table === "visits") {
      const visit = records?.visits.find((candidate) => candidate.id === record.id);
      return visit && { is: fill(text.visitOn, { day: day(visit.at) }), href: `/app/visits?sheet=${visit.id}` };
    }
    const request = records?.requests.find((candidate) => candidate.id === record.id);
    return request && {
      is: fill(happened[request.status] ?? text.requestOn.other, { kind: kinds[request.kind], amount: money(request.amount), status: request.status, day: day(request.at) }),
      href: request.neighborId ? `/app/neighbors?neighbor=${request.neighborId}` : null,
    };
  };
  const recordLine = (flag: Flag) => {
    const said = line(flag);
    if (!said) return null;
    return (
      <p key={flag.record.id} className="report-check-record">
        {said.is}
        {said.href && (
          <Link className="live-link" href={said.href} aria-label={text.openRecord(said.is)}>
            {text.openShort}
          </Link>
        )}
      </p>
    );
  };

  // Nothing found is the yes: once the sheet has been laid down, its corner turns green and presses flat.
  const clear = result.flags.length === 0;
  // A note nobody read is not a finding: when the assistant could not read, the sheet says so and claims nothing about the note.
  const unsure = result.verification === "review";
  const fromNote = (kind: Flag["kind"]) => kind === "noteSaysPaid" || kind === "visitNotMarked";
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.closest("section")?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!clear) return;
    const wait = setTimeout(() => setFolded(true), 420);
    return () => clearTimeout(wait);
  }, [clear]);

  return (
    <section
      className={folded ? "help-sheet report-check paper-fold" : "help-sheet report-check"}
      aria-labelledby="year-check-title"
      data-clear={clear}
    >
      <p className="help-sheet-label">{text.title}</p>
      <h2 id="year-check-title" tabIndex={-1} ref={title}>
        {result.flags.length ? text.count(result.flags.length) : text.clear}
      </h2>
      <p>
        {fill(text.checked, {
          requests: text.requests(checked.requests),
          visits: text.visits(checked.visits),
          time: formatDate(words.locale, checked.at, { hour: "numeric", minute: "2-digit", timeZone }),
        })}
      </p>
      {unsure && !clear && <p className="report-check-unsure">{text.unread}</p>}
      {groups.size > 0 && (
        <ul className="paper-rows">
          {[...groups].map(([key, flags]) => {
            const [{ kind, source }] = flags;
            const shown = flags.length === 1 || open.includes(key);
            return (
              <li key={key} data-source={unsure && fromNote(kind) ? "unread" : source}>
                <p className="help-why">{unsure && kind === "noteSaysPaid" ? text.noteMaySayPaid : unsure && kind === "visitNotMarked" ? text.visitMayBeDone : text[kind]}</p>
                {unsure && fromNote(kind) ? (
                  <p>{text.notRead}</p>
                ) : source === "assistant" ? (
                  <p className="help-assistant">
                    <Sparkles size={16} aria-hidden="true" />
                    {text.byAssistant}
                  </p>
                ) : (
                  <p>{text.byRule}</p>
                )}
                {flags.length > 1 && (
                  <Button
                    variant="ghost"
                    className="report-check-more"
                    aria-expanded={shown}
                    aria-controls={`year-check-${key}`}
                    onClick={() => setOpen(shown ? open.filter((other) => other !== key) : [...open, key])}
                  >
                    {shown ? text.hide(flags.length) : text.show(flags.length)}
                    <ChevronDown size={17} aria-hidden="true" />
                  </Button>
                )}
                {shown && <div id={`year-check-${key}`}>{flags.map(recordLine)}</div>}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" onClick={onClose}>
        {text.putAway}
      </Button>
    </section>
  );
}
