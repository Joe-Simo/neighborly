"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formatDate, type Language, type Words } from "@/lib/words";
import { kindLabels, money } from "@/components/workspace/reports/lines";

export type YearCheckResult = FunctionReturnType<typeof api.drafts.checkYear>;
export type FlaggedRecords = FunctionReturnType<typeof api.reports.flagged>;
type Flag = YearCheckResult["flags"][number];

/** The sheet's own English words, used until the shared words carry them; the shared ones win when they do. */
const english = {
  putAway: "Put this away",
  checked: "Checked {requests}, {visits} and the ledger, today at {time}.",
  requests: (count: number) => (count === 1 ? "1 request" : `${count} requests`),
  visits: (count: number) => (count === 1 ? "1 visit" : `${count} visits`),
  show: (count: number) => `Show the ${count} records`,
  hide: (count: number) => `Hide the ${count} records`,
  openShort: "Open",
  happened: { open: "received", approved: "approved", paid: "marked paid", declined: "declined", closed: "closed" },
  visit: "Home visit",
};

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
  const text = { ...english, ...words.yearCheck };
  const happened: Record<string, string> = text.happened;
  // The kinds of help in the reader's language, once the shared words carry them.
  const { kinds = kindLabels }: { locale: Language; kinds?: typeof kindLabels } = words;
  const day = (at: number) => formatDate(words.locale, at, { month: "short", day: "numeric", timeZone });

  const line = ({ record }: Flag) => {
    if (record.table === "visits") {
      const visit = records?.visits.find((candidate) => candidate.id === record.id);
      return visit && { is: `${text.visit}, ${day(visit.at)}`, href: `/app/visits?sheet=${visit.id}` };
    }
    const request = records?.requests.find((candidate) => candidate.id === record.id);
    return request && {
      is: `${kinds[request.kind]}, ${money(request.amount)}, ${happened[request.status] ?? request.status} ${day(request.at)}`,
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
          <Link className="live-link" href={said.href} aria-label={`${text.open}: ${said.is}`}>
            {text.openShort}
          </Link>
        )}
      </p>
    );
  };

  // Nothing found is the yes: once the sheet has been laid down, its corner turns green and presses flat.
  const clear = result.flags.length === 0;
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
      <h2 id="year-check-title" tabIndex={-1}>
        {result.flags.length ? text.count(result.flags.length) : text.clear}
      </h2>
      <p>
        {text.checked
          .replace("{requests}", text.requests(checked.requests))
          .replace("{visits}", text.visits(checked.visits))
          .replace("{time}", formatDate(words.locale, checked.at, { hour: "numeric", minute: "2-digit", timeZone }))}
      </p>
      {groups.size > 0 && (
        <ul className="paper-rows">
          {[...groups].map(([key, flags]) => {
            const [{ kind, source }] = flags;
            const shown = flags.length === 1 || open.includes(key);
            return (
              <li key={key} data-source={source}>
                <p className="help-why">{text[kind]}</p>
                {source === "assistant" ? (
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
