"use client";

import { useState } from "react";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { Words } from "@/lib/words";
import { count, kindLabels, money, plural } from "@/components/workspace/reports/lines";

export type YearCheckResult = FunctionReturnType<typeof api.drafts.checkYear>;
export type FlaggedRecords = FunctionReturnType<typeof api.reports.flagged>;
type Flag = YearCheckResult["flags"][number];

const happened: Record<string, string> = { open: "received", approved: "approved", paid: "marked paid", declined: "declined", closed: "closed" };

/**
 * What the check before sending found, on the screen's one sheet. Lines the assistant read are in plum;
 * every record is said in a line and opens so a person can settle it. Nothing here changes a record.
 */
export function YearCheck({
  text,
  result,
  records,
  checked,
  timeZone,
  onClose,
}: {
  /** The words in the reader's own language. */
  text: Words["yearCheck"];
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
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });

  const line = ({ record }: Flag) => {
    if (record.table === "visits") {
      const visit = records?.visits.find((candidate) => candidate.id === record.id);
      return visit && { is: `Home visit, ${day.format(visit.at)}`, href: `/app/visits?sheet=${visit.id}` };
    }
    const request = records?.requests.find((candidate) => candidate.id === record.id);
    return request && {
      is: `${kindLabels[request.kind]}, ${money(request.amount)}, ${happened[request.status] ?? request.status} ${day.format(request.at)}`,
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
            Open
          </Link>
        )}
      </p>
    );
  };

  return (
    <section className="help-sheet report-check" aria-labelledby="year-check-title" data-clear={result.flags.length === 0}>
      <p className="help-sheet-label">{text.title}</p>
      <h2 id="year-check-title" tabIndex={-1}>
        {result.flags.length ? text.count(result.flags.length) : text.clear}
      </h2>
      <p>
        Checked {plural(checked.requests, "request")}, {plural(checked.visits, "visit")} and the ledger, today at {time.format(checked.at)}.
      </p>
      {groups.size > 0 && (
        <ul>
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
                    {shown ? `Hide the ${count(flags.length)} records` : `Show the ${count(flags.length)} records`}
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
        Put this away
      </Button>
    </section>
  );
}
