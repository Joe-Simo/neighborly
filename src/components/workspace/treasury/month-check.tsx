"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { formatFigure } from "@/components/workspace/treasury/money";
import { dayLabel, type LedgerEntry } from "@/components/workspace/treasury/labels";
import { checkWords } from "./check-words";

type Result = FunctionReturnType<typeof api.drafts.checkMonth>;

/**
 * Before a month is closed or reported: the lines worth a second look. It changes nothing; each row opens its entry.
 * Only a flag the assistant raised wears the plum assistant line; the rules' flags are plain.
 */
export function MonthCheck({ churchId, month, entries, onEntry }: { churchId: Id<"churches">; month: string; entries: LedgerEntry[]; onEntry: (entry: LedgerEntry) => void }) {
  const { words } = useWorkspace();
  const text = checkWords(words.locale);
  const checkMonth = useAction(api.drafts.checkMonth);
  const [state, setState] = useState<"idle" | "checking" | "failed" | Result>("idle");
  const run = async () => {
    setState("checking");
    try {
      setState(await checkMonth({ churchId, month }));
    } catch {
      setState("failed");
    }
  };
  const result = typeof state === "object" ? state : null;
  return (
    <section className="treasury-check" aria-live="polite">
      <Button variant="outline" onClick={() => void run()} disabled={state === "checking"} data-waiting={state === "checking" || undefined}>
        {state === "checking" ? text.checking : text.check}
      </Button>
      {state === "failed" && <p>{text.failed}</p>}
      {result && (
        <>
          <p>{result.flags.length ? text.found(result.flags.length) : text.clear}</p>
          {result.verification === "review" && result.flags.length > 0 && <p>{text.unread}</p>}
          <ul className="paper-rows">
            {result.flags.map((flag) => {
              const entry = entries.find((row) => row.id === flag.entryId);
              const said = text.kinds[flag.kind];
              return (
                <li key={`${flag.kind}-${flag.entryId}`}>
                  <button type="button" className="live-link" disabled={!entry} onClick={() => entry && onEntry(entry)}>
                    {entry && `${dayLabel(words.locale, entry.date)} · ${entry.payee || "—"} · ${formatFigure(entry.amount)}`}
                  </button>
                  {flag.source === "assistant" ? (
                    <p className="help-assistant">
                      <Sparkles size={16} aria-hidden="true" />
                      {said}
                    </p>
                  ) : (
                    <p>{said}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
