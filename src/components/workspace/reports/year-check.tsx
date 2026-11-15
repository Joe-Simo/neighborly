"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import type { Words } from "@/lib/words";

export type YearCheckResult = FunctionReturnType<typeof api.drafts.checkYear>;
type Flag = YearCheckResult["flags"][number];

/**
 * What the check before sending found, on the screen's one sheet. Lines the assistant read are in plum;
 * every line opens the record so a person can settle it. Nothing here changes a record.
 */
export function YearCheck({
  text,
  result,
  homes,
  onClose,
}: {
  /** The words in the reader's own language. */
  text: Words["yearCheck"];
  result: YearCheckResult;
  /** The neighbor record that holds each flagged request. */
  homes: ReadonlyMap<Id<"assistanceRequests">, Id<"neighbors"> | null>;
  onClose: () => void;
}) {
  const groups = new Map<string, Flag[]>();
  for (const flag of result.flags) groups.set(`${flag.kind} ${flag.source}`, [...(groups.get(`${flag.kind} ${flag.source}`) ?? []), flag]);
  const address = ({ record }: Flag) => {
    if (record.table === "visits") return `/app/visits?sheet=${record.id}`;
    const neighborId = homes.get(record.id);
    return neighborId ? `/app/neighbors?neighbor=${neighborId}` : null;
  };

  return (
    <section className="help-sheet report-check" aria-labelledby="year-check-title" data-clear={result.flags.length === 0}>
      <p className="help-sheet-label">{text.title}</p>
      <h2 id="year-check-title" tabIndex={-1}>
        {result.flags.length ? text.count(result.flags.length) : text.clear}
      </h2>
      {groups.size > 0 && (
        <ul>
          {[...groups.values()].map((flags) => {
            const [{ kind, source }] = flags;
            return (
              <li key={`${kind} ${source}`} data-source={source}>
                <div>
                  <p className="help-why">{text[kind]}</p>
                  {source === "assistant" ? (
                    <p className="help-assistant">
                      <Sparkles size={16} aria-hidden="true" />
                      {text.byAssistant}
                    </p>
                  ) : (
                    <p>{text.byRule}</p>
                  )}
                </div>
                <nav aria-label={text[kind]}>
                  {flags.map((flag, index) => {
                    const href = address(flag);
                    if (!href) return null;
                    return (
                      <Link key={flag.record.id} href={href} aria-label={flags.length > 1 ? `${text.open} ${index + 1}` : undefined}>
                        {flags.length > 1 ? index + 1 : text.open}
                      </Link>
                    );
                  })}
                </nav>
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
