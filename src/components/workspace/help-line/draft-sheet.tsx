"use client";

import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { Check, Sparkles } from "lucide-react";
import type { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { words } from "@/lib/words";
import type { Workspace } from "@/components/workspace/context";
import {
  kindLabels,
  shortMoney,
  type Call,
} from "@/components/workspace/help-line/format";

type Draft = FunctionReturnType<typeof api.drafts.draftRequest>;
/** Only what the sheet itself reads, so it can be laid down anywhere a call and its draft are known. */
type Sheet = {
  call: Pick<Call, "neighborId" | "neighborName" | "callerName" | "takenAt" | "note">;
  draft: Pick<Draft, "kind" | "amountRequested" | "payeeKind" | "payeeName" | "quote">;
};

export const caller = (call: Pick<Call, "neighborName" | "callerName">) =>
  call.neighborName ?? (call.callerName || "New caller");

/**
 * The one thing waiting for a yes: what the assistant drafted from a call note. Plum marks its words.
 * It is a file of its own, with no backend in it, because the home page lays down this same sheet
 * (src/components/home-yes-card.tsx): whatever changes here changes there.
 */
export function DraftSheet({
  drafted: { call, draft },
  waiting = 1,
  sealed = false,
  arriving = false,
  format,
  pending,
  toDo,
  limits,
  onApprove,
  onChange,
  onDiscard,
}: {
  drafted: Sheet;
  /** How many drafts wait for a yes, this one included. */
  waiting?: number;
  /** The yes was given and the request is on the record: the corner folds to green. */
  sealed?: boolean;
  /**
   * Laid where the saved sheet before it is closing: unseen, its title not yet named, until that sheet has gone.
   * Then it is laid down whole, as any sheet is.
   */
  arriving?: boolean;
  format: Workspace["format"];
  pending: boolean;
  /** What the person must do before the yes, in ink above the buttons. */
  toDo?: ReactNode;
  /** The plum line at the foot: how the draft was made, and what the assistant saw. */
  limits: ReactNode;
  onApprove: () => void;
  /** Where there is no way to change or discard, the sheet shows neither. */
  onChange?: () => void;
  onDiscard?: () => void;
}) {
  const text = words().assistant;
  const complete =
    !!draft.kind &&
    draft.amountRequested !== null &&
    !!draft.payeeKind &&
    !!draft.payeeName;
  // What the note did not say stays blank, and the sheet says so in plain words.
  const missing = [
    !draft.kind && "the kind of help",
    draft.amountRequested === null && "the amount",
    (!draft.payeeKind || !draft.payeeName) && "who is paid",
  ].filter((part) => part !== false);
  const empty =
    !draft.kind && draft.amountRequested === null && !draft.payeeName;
  const title = empty
    ? "Nothing to draft from this note yet"
    : [
        draft.kind ? kindLabels[draft.kind] : "A request",
        draft.amountRequested !== null && shortMoney(draft.amountRequested),
      ]
        .filter((part) => part !== false)
        .join(", ");
  return (
    <section
      className={sealed ? "help-sheet paper-fold help-sealed" : "help-sheet"}
      data-fold-leaves={sealed ? "" : undefined}
      data-arriving={arriving ? "" : undefined}
      aria-labelledby={arriving ? undefined : "draft-title"}
      data-blank={complete ? undefined : ""}
    >
      <p className="help-sheet-label">
        {sealed
          ? "Saved, waiting for a decision"
          : complete
            ? text.waiting(waiting)
            : "A draft with blanks"}
      </p>
      <div className="help-sheet-body">
        <div>
          {/* The card leads with the call it was made from, so the line under it is never taken for a ledger entry.
              The name is read from the call row for display only; it is not part of the draft or of what the assistant saw. */}
          <p className="help-from">
            {call.neighborName || call.callerName ? (
              <strong>{caller(call)}</strong>
            ) : (
              "A caller who gave no name"
            )}{" "}
            called on {format(call.takenAt, { weekday: "long", month: "long" })}
          </p>
          <h2 id={arriving ? undefined : "draft-title"}>
            {title}
            {draft.payeeName && ` to ${draft.payeeName}`}
          </h2>
          {!complete && (
            <p className="help-assistant help-blank">
              The note does not say{" "}
              {missing.length > 1
                ? `${missing.slice(0, -1).join(", ")} or ${missing.at(-1)}`
                : missing[0]}
              . That is yours to add.
            </p>
          )}
          <p className="help-quote">“{draft.quote || call.note}”</p>
          <p className="help-why">
            From the message taken at{" "}
            {format(call.takenAt, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}
            .{!call.neighborId && " Not yet on file as a neighbor."}
          </p>
          {/* What to do about a blank reads with the text, at its measure, never beside the buttons. */}
          {!complete && !call.neighborId && (
            <p className="help-why">
              First, add {call.callerName || "the caller"} as a neighbor.
            </p>
          )}
          {toDo}
        </div>
        <div className="help-actions" inert={sealed}>
          {complete ? (
            <>
              <Button disabled={pending} onClick={onApprove}>
                <Check size={18} aria-hidden="true" />{" "}
                {call.neighborId ? "Save this request" : "Add neighbor and save"}
              </Button>
              {onChange && (
                <Button variant="outline" disabled={pending} onClick={onChange}>
                  {text.change}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={onChange}>
              {empty ? "Write the request" : "Fill in what is missing"}
            </Button>
          )}
          {onDiscard && (
            <Button
              variant="link"
              className="help-text-action"
              disabled={pending}
              onClick={onDiscard}
            >
              {text.discard}
            </Button>
          )}
        </div>
        {sealed && (
          <p className="help-seal" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12.5l5 5L19.5 7" pathLength={1} />
            </svg>
            {text.saved}
          </p>
        )}
      </div>
      <p className="help-assistant help-assistant-line">
        <Sparkles size={16} aria-hidden="true" />
        {limits}
      </p>
    </section>
  );
}
