"use client";

import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { Check, Sparkles } from "lucide-react";
import type { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { nameKeeper } from "@/components/workspace/keep-names";
import { words as book, type Words } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import type { Workspace } from "@/components/workspace/context";
import {
  shortMoney,
  type Call,
} from "@/components/workspace/help-line/format";

type Draft = FunctionReturnType<typeof api.drafts.draftRequest>;
/** Only what the sheet itself reads, so it can be laid down anywhere a call and its draft are known. */
type Sheet = {
  call: Pick<Call, "neighborId" | "neighborName" | "callerName" | "takenAt" | "note">;
  draft: Pick<Draft, "kind" | "amountRequested" | "payeeKind" | "payeeName" | "quote">;
};

/** The name the person typed when they took the call leads; a record's name stands in only when none was typed. */
export const caller = (call: Pick<Call, "neighborName" | "callerName">, words?: Words) =>
  call.callerName || call.neighborName || (words ?? book()).assistant.sheet.newCaller;

/**
 * The one thing waiting for a yes: what the assistant drafted from a call note. Plum marks its words.
 * It is a file of its own, with no backend in it, because the home page lays down this same sheet
 * (src/components/home-yes-card.tsx): whatever changes here changes there. Its still copy for readers without scripts
 * (src/components/home-yes.tsx, .home-yes-still) does not follow by itself: change it by hand.
 */
export function DraftSheet({
  drafted: { call, draft },
  waiting = 1,
  sealed = false,
  deciding = false,
  paperSeal = false,
  arriving = false,
  format,
  pending,
  toDo,
  limits,
  onApprove,
  onChange,
  onDiscard,
  words = book(),
}: {
  drafted: Sheet;
  /** How many drafts wait for a yes, this one included. */
  waiting?: number;
  /** The yes was given and the request is on the record: the corner folds to green. */
  sealed?: boolean;
  /** Approve was pressed and the answer is on its way: the corner is half folded, and holds there until it comes. */
  deciding?: boolean;
  /** Saved, the corner lies down in the sheet's own paper: the request is on the record, still waiting for its decision. */
  paperSeal?: boolean;
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
  /** The person's own words. The home page lays this sheet down outside a workspace, and it reads in English there. */
  words?: Words;
}) {
  const text = words.assistant;
  const sheet = text.sheet;
  const callerName = call.callerName.trim();
  const firstName = callerName.split(/\s+/)[0] ?? "";
  const room = words.rooms.helpLine.draft;
  const complete =
    !!draft.kind &&
    draft.amountRequested !== null &&
    !!draft.payeeKind &&
    !!draft.payeeName;
  // What the note did not say stays blank, and the sheet says so in plain words.
  const missing = !draft.kind && draft.amountRequested === null ? sheet.notSaid.both : !draft.kind ? sheet.notSaid.kind : draft.amountRequested === null ? sheet.notSaid.amount : "";
  // Who is paid is never claimed about the note: the note may name them in words the draft could not read.
  const unpaid = !draft.payeeKind || !draft.payeeName;
  const empty =
    !draft.kind && draft.amountRequested === null && !draft.payeeName;
  // The title is one whole line in each language: what is asked, how much, and to whom, as far as the note said.
  const what = draft.kind ? words.kinds[draft.kind] : sheet.aRequest;
  const amount = draft.amountRequested === null ? null : shortMoney(draft.amountRequested);
  // A payee's name is kept whole: the headline breaks before it, and only a name longer than the line turns inside it.
  const payee = draft.payeeName ?? undefined;
  const title = empty
    ? sheet.nothingYet
    : amount !== null && payee
      ? fill(room.amountPayee, { what, amount, payee })
      : amount !== null
        ? fill(room.amount, { what, amount })
        : payee
          ? fill(room.payee, { what, payee })
          : what;
  return (
    <section
      className={sealed ? (paperSeal ? "help-sheet help-sealed" : "help-sheet paper-fold help-sealed") : "help-sheet"}
      data-fold-leaves={sealed ? "" : undefined}
      data-deciding={deciding ? "" : undefined}
      data-arriving={arriving ? "" : undefined}
      aria-labelledby={arriving ? undefined : "draft-title"}
      data-blank={complete ? undefined : ""}
      // The sheet can hold focus itself: when its button rests after a yes, focus stays on the sheet, not on nothing.
      tabIndex={-1}
    >
      {/* The answer is slow: the one waiting mark stands at the half-folded corner (after 400ms, help-line.css). */}
      {deciding && <span className="help-fold-ring" aria-hidden="true" />}
      <p className="help-sheet-label">
        {sealed
          ? text.approved
          : complete
            ? text.waiting(waiting)
            : waiting > 1
              ? room.blanksWaiting(waiting)
              : sheet.blanks}
      </p>
      <div className="help-sheet-body">
        <div>
          {/* The card leads with the call it was made from, so the line under it is never taken for a ledger entry.
              The name is read from the call row for display only; it is not part of the draft or of what the assistant saw. */}
          <p className="help-from">
            {call.neighborName || call.callerName ? (
              <strong>{caller(call, words)}</strong>
            ) : (
              sheet.noName
            )}{" "}
            {sheet.calledOn(format(call.takenAt, { weekday: "long", month: "long" }))}
          </p>
          <h2 id={arriving ? undefined : "draft-title"}>
            {payee ? nameKeeper([payee])(title) : title}
          </h2>
          {!complete && (
            <p className="help-assistant help-blank">
              {[missing && sheet.noteDoesNotSay(missing), unpaid && sheet.unpaid, sheet.yours(Number(!draft.kind) + Number(draft.amountRequested === null) + Number(unpaid))].filter(Boolean).join(" ")}
            </p>
          )}
          <p className="help-quote">“{draft.quote || call.note}”</p>
          <p className="help-why">
            {sheet.takenAt(format(call.takenAt, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" }))}
            {!call.neighborId && ` ${sheet.notOnFile(firstName)}`}
          </p>
          {/* What to do about a blank reads with the text, at its measure, never beside the buttons. */}
          {!complete && !call.neighborId && (
            <p className="help-why">
              {sheet.addFirst(call.callerName)}
            </p>
          )}
          {toDo}
        </div>
        <div className="help-actions" inert={sealed}>
          {complete ? (
            <>
              <Button disabled={pending} onClick={onApprove}>
                {call.neighborId ? (
                  <>
                    <Check size={18} aria-hidden="true" /> {text.approve}
                  </>
                ) : (
                  // The caller's name rides in the button, kept whole. Where the line would not fit the button, the
                  // shorter words stand instead, decided as the button is laid, before it is drawn.
                  <span className="help-add" ref={(label) => { label?.toggleAttribute("data-tight", label.scrollWidth > label.clientWidth); }}>
                    <span className="help-add-long">{nameKeeper([callerName])(sheet.addAndSave(callerName))}</span>
                    <span className="help-add-short">{sheet.addAndSave("")}</span>
                  </span>
                )}
              </Button>
              {onChange && (
                <Button variant="outline" disabled={pending} onClick={onChange}>
                  {text.change}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={onChange}>
              {empty ? sheet.write : sheet.fill}
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
          // The one done mark, the circled tick; its check is drawn in as before. Not said aloud here: the filed
          // line that follows is read by its focus, so a screen reader hears the save once.
          <p className="help-seal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12.2l2.8 2.8L16.2 9.3" pathLength={1} />
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
