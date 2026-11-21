"use client";

import { DateLeaf } from "@/components/workspace/primitives";

import { FOLD_HOLD, foldLeaves, holdThePage, openInPlaceOf, openUp, takeLine, useKeptLine } from "@/components/workspace/fold";
import { AssistantLimits, DraftToDo, UrgencyRead } from "@/components/workspace/week-note/assistant-limits";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useAction, useMutation, useQueries } from "convex/react";
import { keptAnswer, useHour, useQuery } from "@/components/workspace/query";
import { useFirstLook } from "@/components/workspace/first-look";
import { canKeep, keepHelpLine } from "@/lib/kept-room";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import type { Words } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import { useWorkspace, type Workspace, type WayBack } from "@/components/workspace/context";
import { UndoAct } from "@/components/workspace/undo";
import { sayFailure } from "@/components/workspace/failure";
import {
  CallForm,
  NeighborForm,
  RequestForm,
  ReturnForm,
} from "@/components/workspace/help-line/forms";
import { OnTheLine, lineIsSet, owners, turnsToday } from "@/components/workspace/help-line/on-the-line";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveWaiting } from "@/components/workspace/states";
import {
  initials,
  recordHref,
  type Call,
  type Calls,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import { DraftSheet, caller } from "@/components/workspace/help-line/draft-sheet";
import { laySlip, PAPER_EASE, tipTab } from "@/lib/lay-slip";
import {
  HelpDone,
  dropSheetWords,
  letSheetWordsGo,
  readSealedSheet,
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";

type Draft = FunctionReturnType<typeof api.drafts.draftRequest>;
type Drafted = { call: Call; draft: Draft };
/** The line that says what changed, and where it leads: a neighbor's record, or a draft of the call just saved. */
type Done = { message: string; record?: Id<"neighbors">; draft?: Call["id"]; filed?: { name: string; asks: string }; back?: WayBack };
type Step =
  | { kind: "log" }
  | {
      kind: "return" | "request" | "neighbor" | "draft";
      call: Call;
      /** The assistant was asked for a draft and could not give one. */
      undrafted?: boolean;
    }
  | { kind: "change"; drafted: Drafted; neighborId?: Id<"neighbors"> }
  // The caller is not on file yet: the neighbor is added first, then the draft goes on.
  | { kind: "join"; drafted: Drafted; then: "approve" | "change" };


export function HelpLineSection() {
  return (
    <HelpRoom>
      <HelpLine />
    </HelpRoom>
  );
}

/** A refusal opens its own room as it is laid, so the sheet under it is moved aside and never jumps; it stays while it is true. */
const laidToStay = (notice: HTMLElement | null) => {
  if (notice) openUp(notice, { stays: true });
};

/** Whether the sample door's arrival has already put the keyboard on the waiting sheet, this visit. */
let sampleDoorFocused = false;

/** What a first look asks: nothing, the same object every time, so the subscription never changes under it. */
const nothingAsked = {};

function HelpLine() {
  const { data, format, now, setHeadAction, words, sampleSaid } = useWorkspace();
  const text = words.rooms.helpLine;
  // The person's words as they stand now, for the saved line that is said after a wait (the sealed sheet's effect).
  const spoken = useRef(words);
  useEffect(() => {
    spoken.current = words;
  }, [words]);
  const churchId = data.church.id;
  const at = useHour();
  const calls = useQuery(api.assistance.calls, at ? { churchId, at } : "skip");
  const draftRequest = useAction(api.drafts.draftRequest);
  const createRequest = useMutation(api.assistance.createRequest);
  const setUrgency = useMutation(api.assistance.setUrgency);
  const takeBackCall = useMutation(api.assistance.takeBackCall);
  const unmarkReturned = useMutation(api.assistance.unmarkReturned);
  const drafting = useSave();
  const approving = useSave("decided");
  // Every draft waits for its own yes; asking for another never drops one. The newest is on the sheet.
  // The group keeps them, so they are still here after leaving the page. Until the backend can
  // keep them they stay on this page only.
  const asked = useMemo(() => {
    const kept: Parameters<typeof useQueries>[0] = {
      kept: { query: api.assistance.drafts, args: { churchId } },
    };
    return kept;
  }, [churchId]);
  // In a first look at the kept help line (lib/kept-room.ts) nothing is asked: the drafts it kept are the answer.
  const look = useFirstLook();
  const live: FunctionReturnType<typeof api.assistance.drafts> | Error | undefined = useQueries(look ? nothingAsked : asked).kept;
  const answer = look ? (keptAnswer(look.answers, api.assistance.drafts) as FunctionReturnType<typeof api.assistance.drafts> | undefined) : live;
  const kept = answer instanceof Error ? undefined : answer;
  const keepDraft = useMutation(api.assistance.keepDraft);
  const discardDraft = useMutation(api.assistance.discardDraft);
  // The draft whose discard was refused, so the plum notice speaks of the discard and not of a request. It is
  // set in the same breath as the refusal's sentence, and dropped as soon as anything else is being saved, so
  // a later refusal (of a yes, say) is never given the discard's words.
  const [undiscarded, setUndiscarded] = useState<Call["id"] | null>(null);
  if (undiscarded && approving.pending) setUndiscarded(null);
  const [here, setDrafts] = useState<Drafted[]>([]);
  const drafts = kept ?? here;
  // In the iOS app the help line's first screen is kept on the device once it is live and whole, for a launch from the
  // Home Screen to draw at once. Only what this room already reads is kept: the calls, the drafts, and that the room is
  // open to this person (it is drawn only then).
  useEffect(() => {
    if (look || !canKeep() || !calls || kept === undefined) return;
    keepHelpLine(data.user.id, churchId, {
      [getFunctionName(api.assistance.calls)]: calls,
      [getFunctionName(api.assistance.drafts)]: kept,
      [getFunctionName(api.access.canOpenNeighborRecords)]: true,
    });
  }, [look, calls, kept, data.user.id, churchId]);
  const newest = drafts.at(0) ?? null;
  // The call as it stands now, so a draft knows once its caller is on file.
  const drafted = newest && {
    ...newest,
    call:
      calls?.waiting.find((call) => call.id === newest.call.id) ?? newest.call,
  };
  const settle = (call: Call) =>
    setDrafts((all) => all.filter((one) => one.call.id !== call.id));
  const [step, setStep] = useState<Step | null>(null);
  // A line with its way back is kept while the person steps into another room, and is here again on return in its time.
  const [returned] = useState(() => takeLine<Done>("help-line"));
  const [done, setDone] = useState<Done | null>(returned?.value ?? null);
  useKeptLine("help-line", done?.back ? done : undefined, returned);
  // An undo the server would not take: said in plum, and the act stands.
  const [undoRefused, setUndoRefused] = useState("");
  const finish = (message: string, more: Omit<Done, "message"> = {}) => {
    setStep(null);
    setUndoRefused("");
    setDone({ message, ...more });
  };
  // The calls as they stand now, for work that finishes after the list has moved on.
  const latest = useRef(calls);
  useEffect(() => {
    latest.current = calls;
  }, [calls]);
  // The call whose note the assistant is reading.
  const [reading, setReading] = useState<Call["id"] | null>(null);
  const close = () => setStep(null);
  // The saved draft stays a moment with its corner folded, then the next one rises.
  const [sealed, setSealed] = useState<
    (Drafted & { neighborId: Id<"neighbors"> }) | null
  >(null);
  // From the moment the saved draft starts to close, the next one waiting is laid in its place.
  const [handing, setHanding] = useState(false);
  // The draft whose Approve was pressed and is on its way: its corner is folding, held half down until the answer.
  const [pressing, setPressing] = useState<Call["id"] | null>(null);
  useEffect(() => {
    if (!sealed) return;
    let left = false;
    const after = setTimeout(() => {
      // The sheet's own words, read off it, are what the saved line carries: they travel there as the sheet closes.
      const asks = readSealedSheet();
      // They go from the sheet where they stand, the seal with them, before anything moves (room.tsx).
      void letSheetWordsGo().then(() => {
        if (left) return dropSheetWords();
        // The line opens as the sheet closes, in one move: it is laid first, so the close knows it is there, and the
        // close, the line and the line's words all start on the same frame, so the room only ever gets shorter. The
        // sheet is taken out the moment its close ends, before anything is drawn; for less motion the close is a plain
        // cut, so the line and the cut are one change.
        flushSync(() => {
          const words = spoken.current;
          const said = words.rooms.helpLine.done;
          setDone({
            message: asks ? fill(said.savedToDecide, { name: caller(sealed.call, words) }) : fill(said.savedOnRecord, { name: caller(sealed.call, words) }),
            record: sealed.neighborId,
            filed: asks ? { name: caller(sealed.call, words), asks } : undefined,
          });
          setHanding(true);
        });
        // A next draft is laid under the closing sheet, and its room opens as the other's closes, so what is under
        // them moves once and never jumps. It is drawn, whole, once the saved sheet has gone.
        const next = document.querySelector<HTMLElement>(".help-sheet[data-arriving]");
        const going = document.querySelector<HTMLElement>(".help-sheet.help-sealed");
        if (next && going) openInPlaceOf(next, going);
        void foldLeaves().then(() =>
          flushSync(() => {
            setSealed(null);
            setHanding(false);
          }),
        );
      });
    }, FOLD_HOLD);
    return () => {
      left = true;
      clearTimeout(after);
    };
  }, [sealed]);
  const onSheet = sealed ?? drafted;
  // The draft that waits next, laid under the saved one while it closes.
  const next = sealed && handing && drafted && drafted.call.id !== sealed.call.id ? drafted : null;
  const sheetOpen = onSheet !== null;
  // Arrived by the home page's sample door (SAMPLE_DOOR): the keyboard and a screen reader start on the waiting sheet's own first act,
  // so the walk is one press. Only focus moves, without scrolling, once per visit; nothing on the page moves.
  useEffect(() => {
    if (!sheetOpen || sampleDoorFocused || new URLSearchParams(window.location.search).get("intent") !== "sample") return;
    const act = document.querySelector<HTMLElement>(".help-sheet:not([data-arriving]) .help-actions button:not([disabled])");
    if (!act || document.activeElement?.matches("input, textarea, select, [contenteditable]")) return;
    sampleDoorFocused = true;
    act.focus({ preventScroll: true });
  }, [sheetOpen]);
  // A sheet is opened in a transition: the press is painted first (the button pressed), and the sheet lifts after.
  const log = useCallback(() => {
    setDone(null);
    startTransition(() => setStep({ kind: "log" }));
  }, []);
  const draftsUnknown = answer === undefined;
  useLayoutEffect(() => {
    setHeadAction({
      label: text.log,
      run: log,
      quiet: sheetOpen,
      // Until the drafts have arrived the room cannot know whether a sheet will hold the filled button.
      unsettled: draftsUnknown,
      plus: true,
    });
    return () => setHeadAction(null);
  }, [setHeadAction, log, sheetOpen, draftsUnknown, text.log]);
  /** Runs an act's way back; the line then says what came of it, with no way back of its own. */
  const undoDone = (back: WayBack) => async () => {
    try {
      await back.run();
      setDone({ message: back.said });
    } catch (cause) {
      setDone(null);
      setUndoRefused(sayFailure(words.notices,cause, words.notices.failed));
    }
  };
  const saved = (call: Call) => {
    settle(call);
    finish(
      fill(text.done.savedOnRecord, { name: caller(call, words) }),
    );
  };
  function onStep(next: Step) {
    setDone(null);
    approving.clear();
    if (next.kind === "draft") void draftFor(next.call.id);
    else startTransition(() => setStep(next));
  }
  /** Asks the assistant to draft a request from one call's note. The sheet shows it reading meanwhile. */
  async function draftFor(callId: Call["id"]) {
    setDone(null);
    approving.clear();
    setStep(null);
    setReading(callId);
    const outcome = await drafting.save(async () => {
      const draft = await draftRequest({ churchId, callId });
      if (kept) await keepDraft({ churchId, callId, draft });
      return draft;
    });
    setReading(null);
    const call = latest.current?.waiting.find((one) => one.id === callId);
    if (!call) return;
    // If the assistant cannot help, the person writes the request themselves.
    if (outcome.saved)
      setDrafts((all) => [
        { call, draft: outcome.result },
        ...all.filter((one) => one.call.id !== callId),
      ]);
    else
      setStep({
        kind: call.neighborId ? "request" : "neighbor",
        call,
        undrafted: true,
      });
  }
  async function approve(asked: Drafted, neighborId = asked.call.neighborId) {
    const { call, draft } = asked;
    const { kind, amountRequested, payeeKind, payeeName } = draft;
    if (!kind || amountRequested === null || !payeeKind || !payeeName) return;
    if (!neighborId)
      return setStep({ kind: "join", drafted: asked, then: "approve" });
    setStep(null);
    // The button that was pressed rests while the request is saved and sealed, and a resting button lets focus fall to
    // the page. The sheet takes it, so the next key starts from here; the saved line takes it from the sheet.
    document.querySelector<HTMLElement>(".help-sheet:not([data-arriving])")?.focus({ preventScroll: true });
    setPressing(call.id);
    const outcome = await approving.save(() =>
      createRequest({
        churchId,
        neighborId,
        callId: call.id,
        kind,
        summary: call.note,
        amountRequested,
        payeeKind,
        payeeName,
        source: "ai_draft",
      }),
    );
    setPressing(null);
    if (!outcome.saved) return;
    settle(call);
    // The sheet is sealed as the call now stands: a caller just added as a neighbor is on file, so the sealed sheet
    // (and the card it hands over) never goes back to "Add neighbor and save" or "Not yet on file".
    const now = latest.current?.waiting.find((one) => one.id === call.id) ?? call;
    setSealed({ ...asked, call: { ...now, neighborId }, neighborId });
  }
  const changeFor =
    step?.kind === "change"
      ? (step.neighborId ?? step.drafted.call.neighborId)
      : null;
  if (!calls) return <HelpLoading />;
  const read = calls.waiting.find((call) => call.id === reading);
  // A call just saved can go straight on to its draft.
  const offer = calls.waiting.find(
    (call) =>
      call.id === done?.draft &&
      !call.openRequest &&
      !drafts.some((one) => one.call.id === call.id),
  );
  return (
    <>
      {done && (
        <HelpDone
          remaining={returned && done === returned.value ? returned.remaining : undefined}
          // A filed draft is a new line each time, so its words set off from their own sheet.
          key={done.filed ? `${done.record}:${done.filed.asks}` : "said"}
          filed={done.filed}
          action={
            done.back ? (
              <>
                {offer && (
                  <Button variant="link" className="help-text-action" disabled={drafting.pending} onClick={() => void draftFor(offer.id)}>
                    <Sparkles size={15} aria-hidden="true" /> {text.done.draft}
                  </Button>
                )}
                <UndoAct run={undoDone(done.back)} />
              </>
            ) : done.record ? (
              <Link className="live-link" href={recordHref(done.record)}>
                {text.done.openRecord}
              </Link>
            ) : offer ? (
              <Button
                variant="link"
                className="help-text-action"
                disabled={drafting.pending}
                onClick={() => void draftFor(offer.id)}
              >
                <Sparkles size={15} aria-hidden="true" /> {text.done.draft}
              </Button>
            ) : undefined
          }
        >
          {done.message}
        </HelpDone>
      )}
      {undoRefused && !done && (
        <div className="live-error" role="alert">
          <p>{undoRefused}</p>
        </div>
      )}
      {(approving.error || drafting.error) && (
        <div className="live-error" role="alert" ref={laidToStay}>
          <p>
            {approving.error && undiscarded
              ? text.refused.discard
              : approving.error ||
                text.refused.draft}
          </p>
          <p className="live-error-recovery">
            {approving.error && undiscarded
              ? // The reason as the backend gave it, then what is true now: the draft was not thrown away.
                fill(text.refused.stillOnSheet, { reason: approving.error })
              : approving.error
                ? text.refused.stillHere
                : text.refused.writeYourself}
          </p>
        </div>
      )}
      {/* A conference with no call and no turn on the line has nothing for the side column to say. */}
      {(calls.waiting.length > 0 || calls.returned.length > 0 || lineIsSet({ data })) && (
        <OnTheLine turns={turnsToday({ data, now, format })} calling={owners(calls.waiting)} />
      )}
      <HelpLineView
        calls={calls}
        at={at}
        format={format}
        busy={drafting.pending}
        reading={reading}
        draftedCallIds={drafts.map((one) => one.call.id)}
        onFirst={
          // An older backend sends no "urgent" on a call and cannot keep one.
          [...calls.waiting, ...calls.returned].some(
            (call) => call.urgent !== undefined,
          )
            ? (call, first) =>
                void approving.save(() =>
                  setUrgency({
                    churchId,
                    callId: call.id,
                    reasons: first ? ["marked"] : [],
                  }),
                )
            : undefined
        }
        onStep={onStep}
        sheet={
          drafting.pending && !sealed ? (
            <ReadingSheet note={read?.note} />
          ) : (
            [onSheet, next].map(
              (one) =>
                one && (
                  <DraftSheet
                    key={one.call.id}
                    drafted={one}
                    sealed={one === sealed}
                    deciding={pressing === one.call.id && one !== sealed}
                    paperSeal
                    arriving={one === next}
                    waiting={drafts.length}
                    format={format}
                    words={words}
                    say={sampleSaid}
                    // Once saved, its buttons stay as they were while saving and fade from there with the seal,
                    // never back to full ink first.
                    pending={approving.pending || one === sealed}
                    toDo={
                      <>
                        <DraftToDo notes={one.draft.notes} />
                        {/* A discard (or a yes) held by a lost connection: one quiet line above the resting buttons. Once the
                            yes is saved the line's words go and its place stays until the sheet does, so the seal moves nothing below. */}
                        <LiveWaiting when={approving.pending && one === onSheet} keep={one === sealed} />
                      </>
                    }
                    limits={
                      <AssistantLimits
                        callId={one.call.id}
                        verification={one.draft.verification}
                        notes={one.draft.notes}
                      />
                    }
                    onApprove={() => void approve(one)}
                    onChange={() =>
                      setStep(
                        one.call.neighborId
                          ? { kind: "change", drafted: one }
                          : { kind: "join", drafted: one, then: "change" },
                      )
                    }
                    onDiscard={async () => {
                      // An earlier green line would stand beside this draft's own answer; it is taken down first.
                      setDone(null);
                      // A draft the group keeps is only gone once the backend says so. Until then it stays on its
                      // sheet, its buttons resting (the sheet's `pending`), and nothing is said to be done. If the
                      // discard is refused the draft is left where it is and the notice says so in plum.
                      if (kept) {
                        const outcome = await approving.save(async () => {
                          try {
                            await discardDraft({ churchId, callId: one.call.id });
                          } catch (cause) {
                            setUndiscarded(one.call.id);
                            throw cause;
                          }
                        });
                        if (!outcome.saved) return;
                      }
                      // A draft kept on this page only has nothing to wait for.
                      settle(one.call);
                      setDone({ message: text.done.discarded });
                    }}
                  />
                ),
            )
          )
        }
      />
      {step?.kind === "join" && (
        <LiveDialog
          title={text.sheets.join.title}
          description={text.sheets.join.deck}
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            call={step.drafted.call}
            submit={
              step.then === "approve"
                ? text.sheets.join.saveAndRequest
                : text.sheets.join.saveAndContinue
            }
            submitNew={
              step.then === "approve"
                ? text.sheets.join.saveNewAndRequest
                : text.sheets.join.saveNewAndContinue
            }
            useLabel={
              step.then === "approve"
                ? text.sheets.join.useAndSave
                : text.sheets.join.use
            }
            onSaved={(neighborId) =>
              step.then === "approve"
                ? void approve(step.drafted, neighborId)
                : setStep({ kind: "change", drafted: step.drafted, neighborId })
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "change" && changeFor && (
        <LiveDialog
          title={text.sheets.change.title}
          description={text.sheets.change.deck(caller(step.drafted.call, words))}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={changeFor}
            callId={step.drafted.call.id}
            start={{
              ...step.drafted.draft,
              kind: step.drafted.draft.kind ?? undefined,
              summary: step.drafted.call.note,
              source: "ai_draft",
            }}
            onSaved={() => saved(step.drafted.call)}
          />
        </LiveDialog>
      )}
      {step?.kind === "log" && (
        <LiveDialog
          title={text.log}
          description={text.sheets.log.deck}
          onClose={close}
        >
          <CallForm
            churchId={churchId}
            draftable
            onSaved={(matched, callId, draft, waiting) =>
              draft
                ? void draftFor(callId)
                : finish(
                    matched
                      ? text.done.callMatched
                      : waiting ? text.done.callWaiting : text.done.callNoBack,
                    { draft: callId, back: { run: () => takeBackCall({ churchId, callId }), said: text.done.callTakenBack } },
                  )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "return" && (
        <LiveDialog
          title={text.sheets.returned.title}
          description={`${caller(step.call, words)}${step.call.phone ? `, ${step.call.phone}` : ""}`}
          onClose={close}
        >
          <ReturnForm
            churchId={churchId}
            call={step.call}
            onSaved={() =>
              finish(
                text.done.returned(caller(step.call, words)),
                { back: { run: () => unmarkReturned({ churchId, callId: step.call.id }), said: text.done.returnedUndone(caller(step.call, words)) } },
              )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "request" && step.call.neighborId && (
        <LiveDialog
          title={text.sheets.request.title}
          description={text.sheets.request.deck(caller(step.call, words))}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={step.call.neighborId}
            callId={step.call.id}
            start={{ summary: step.call.note }}
            onSaved={() => saved(step.call)}
          />
        </LiveDialog>
      )}
      {step?.kind === "neighbor" && (
        <LiveDialog
          title={text.sheets.neighbor.title}
          description={
            step.undrafted
              ? text.sheets.neighbor.undrafted
              : text.sheets.neighbor.deck
          }
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            call={step.call}
            onSaved={() =>
              finish(text.done.neighborAdded)
            }
          />
        </LiveDialog>
      )}
    </>
  );
}

/** Why a call is first, in the reader's language. An unknown reason from a newer backend is left out. */
function whyFirst(urgent: NonNullable<Call["urgent"]>, words: Words) {
  const text = words.urgent;
  const day = urgent.day ?? 0;
  const known = new Map<string, string | ((day: number) => string)>(
    Object.entries(text),
  );
  return urgent.reasons.flatMap((reason) => {
    const say = ["label", "origin", "notUrgent"].includes(reason)
      ? undefined
      : known.get(reason);
    return say === undefined ? [] : [typeof say === "string" ? say : say(day)];
  });
}

function HelpLineView({
  calls,
  format,
  onStep,
  sheet,
  busy = false,
  reading = null,
  draftedCallIds = [],
  onFirst,
  at,
}: {
  /** The whole hour the room was asked at, for how long a call has waited. */
  at?: number;
  /** Moves a call to the front or back again. Left out while the backend cannot keep it. */
  onFirst?: (call: Call, first: boolean) => void;
  /** Calls with a draft waiting for a yes, which are not offered a second draft. */
  draftedCallIds?: Call["id"][];
  calls: Calls;
  format: Workspace["format"];
  onStep: (step: Step) => void;
  /** True while the assistant is drafting, so a second draft cannot start. */
  busy?: boolean;
  /** The call the assistant is reading now. */
  reading?: Call["id"] | null;
  /** The one thing waiting for a yes, when there is one. */
  sheet?: ReactNode;
}) {
  const { words, sampleSaid } = useWorkspace();
  const text = words.rooms.helpLine.calls;
  const isFirst = (call: Call) => !!call.urgent?.reasons.length;
  // How long a call has waited, from the room's hour: "5 hours", "2 days". Two days and more is old.
  const DAY = 24 * 60 * 60 * 1000;
  const waited = (call: Call) => (at === undefined ? 0 : Math.max(0, at - call.takenAt));
  const oldestWaiting = (ms: number) =>
    ms >= DAY ? text.oldestDays(Math.floor(ms / DAY)) : ms >= 3600000 ? text.oldestHours(Math.floor(ms / 3600000)) : text.oldestUnderHour;
  const oldest = calls.waiting.reduce<Call | undefined>((old, call) => (!old || call.takenAt < old.takenAt ? call : old), undefined);
  // A call marked returned leaves where it waited and is laid into "Returned this week". Everything else in
  // the lists that the change moves (the rows under it, the next heading) glides to its new place in the same
  // move, and the page keeps its place: nothing the person is looking at jumps.
  const lists = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, { top: number; waiting: boolean }>());
  const others = useRef(new Map<Element, number>());
  const placed = useRef<string | undefined>(undefined);
  const lineup = [...calls.waiting.map((call) => call.id), "|", ...calls.returned.map((call) => call.id)].join(" ");
  useLayoutEffect(() => {
    // Only a call changing lists moves anything. Otherwise (the room being put in, or turned to whole) where the rows and
    // headings lie is read once the frame has been painted: read here, it made the browser lay out the whole room inside it.
    const changed = placed.current !== undefined && placed.current !== lineup;
    placed.current = lineup;
    if (!changed) {
      let after = 0;
      const frame = requestAnimationFrame(() => {
        after = window.setTimeout(() => {
          before.current = new Map();
          others.current = new Map();
          lists.current?.querySelectorAll<HTMLElement>("[data-call]").forEach((row) => {
            before.current.set(row.dataset.call ?? "", { top: row.getBoundingClientRect().top + window.scrollY, waiting: !("quiet" in row.dataset) });
          });
          lists.current?.querySelectorAll<HTMLElement>(".live-section-head").forEach((head) => {
            others.current.set(head, head.getBoundingClientRect().top + window.scrollY);
          });
        });
      });
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(after);
      };
    }
    const now = new Map<string, { top: number; waiting: boolean }>();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A row gliding under a resting pointer is not being pointed at: it takes no hover wash until it has landed.
    const travel = (piece: HTMLElement, by: number) => {
      piece.style.pointerEvents = "none";
      const move = piece.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { duration: 480, easing: PAPER_EASE });
      const land = () => void (piece.style.pointerEvents = "");
      move.addEventListener("finish", land);
      move.addEventListener("cancel", land);
    };
    const stayed: [HTMLElement, number][] = [];
    // Calls that changed lists this time: laid onto the "returned" count, or (undone) lifted back off it.
    const laid: { row: HTMLElement; from: number }[] = [], lifted: HTMLElement[] = [];
    let travelled = false;
    lists.current
      ?.querySelectorAll<HTMLElement>("[data-call]")
      .forEach((row) => {
        const id = row.dataset.call ?? "";
        const waiting = !("quiet" in row.dataset);
        const top = row.getBoundingClientRect().top + window.scrollY;
        now.set(id, { top, waiting });
        const was = before.current.get(id);
        if (was && was.waiting === waiting) stayed.push([row, was.top - top]);
        if (was && !was.waiting && waiting) lifted.push(row);
        if (!was?.waiting || waiting) return;
        laid.push({ row, from: was.top - window.scrollY });
        travelled = true;
        row.dataset.arrived = "";
        if (still) return;
        row.style.animation = "none";
        // Its place is already kept in "Returned this week". It is drawn there only when the heading and the
        // rows around it have landed (their move is 480ms), so it never lies under or across any of them.
        row.animate(
          [
            { opacity: 0, transform: "translateY(10px)", easing: "linear" },
            { opacity: 0, transform: "translateY(10px)", offset: 480 / 700, easing: "ease-out" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 700 },
        );
      });
    const heads = new Map<Element, number>();
    lists.current?.querySelectorAll<HTMLElement>(".live-section-head").forEach((head) => {
      heads.set(head, head.getBoundingClientRect().top + window.scrollY);
      const was = others.current.get(head);
      if (was !== undefined) stayed.push([head, was - (heads.get(head) ?? was)]);
    });
    if (travelled) {
      holdThePage();
      if (!still) stayed.forEach(([piece, by]) => Math.abs(by) > 1 && travel(piece, by));
    }
    before.current = now;
    others.current = heads;
    // Play the yes, in the room: the returned call's slip is carried from where it waited and laid on the "returned" count, which then steps up
    // by one; undone, it is lifted back off and carried home, and the count steps down. The home page's own move (lay-slip.ts), nothing new.
    const count = lists.current?.querySelector<HTMLElement>("[data-returned-count]");
    if (still || !count || (!laid.length && !lifted.length)) return;
    const said = calls.returned.length;
    // Nothing is laid while a sheet is still on the page (closing, its paper over the list) or the rows are still finding their places:
    // the slip starts at its own size once the room is still, and every place is read in that frame, never as the change lands.
    const sheetOpen = () => Boolean(document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"]'));
    const whenStill = (go: () => void, since = performance.now()) => requestAnimationFrame((now) => {
      if (sheetOpen() || now - since < 480) return whenStill(go, since);
      go();
    });
    const slip = (name: string, left: number, top: number) => {
      const piece = document.createElement("div");
      piece.className = "help-slip";
      piece.setAttribute("aria-hidden", "true");
      piece.textContent = name;
      Object.assign(piece.style, { left: `${left}px`, top: `${top}px` });
      document.body.append(piece);
      return piece;
    };
    const name = (row: HTMLElement) => row.querySelector("h3")?.textContent ?? "";
    count.textContent = text.count(said - laid.length + lifted.length);
    const moves = laid.map(({ row, from }) => ({ row, from, back: false })).concat(lifted.map((row) => ({ row, from: 0, back: true })));
    whenStill(() => {
      const to = count.getBoundingClientRect();
      moves.forEach(({ row, from, back }, index) => {
        const box = row.getBoundingClientRect();
        const piece = slip(name(row), box.left + 56, back ? box.top : from);
        if (back) { count.textContent = text.count(said); tipTab(count); }
        void laySlip(piece, to, to.bottom, { back }).finished.finally(() => {
          piece.remove();
          if (!back && index === moves.length - 1) { count.textContent = text.count(said); tipTab(count); }
        });
      });
    });
  });
  const leaf = (at: number) => {
    const part = (options: Intl.DateTimeFormatOptions) =>
      format(at, { month: undefined, day: undefined, ...options });
    const [time, half = ""] = part({
      hour: "numeric",
      minute: "2-digit",
    }).split(/\s/);
    return (
      <DateLeaf said={format(at, { month: undefined, day: undefined, weekday: "long", hour: "numeric", minute: "2-digit" })}>
        <span>{part({ weekday: "short" })}</span>
        <strong>{time}</strong>
        <span>{half}</span>
      </DateLeaf>
    );
  };
  // No call waiting and none returned: the room says what belongs here, once, and the head carries "Log a call".
  const none = calls.waiting.length === 0 && calls.returned.length === 0;
  return (
    <div className="help-lists" ref={lists}>
      {sheet}
      {none ? (
        <HelpEmpty first title={text.noneTitle}>
          {text.none}
        </HelpEmpty>
      ) : (
      <section>
        <div className="live-section-head">
          <h2>{text.toCallBack}</h2>
          {/* The calls waiting as paper: the figure on a cut slip, how long the oldest has waited as the quiet line under it. */}
          <div className="room-tally">
            {/* The heading names the figure, so the slip carries no label of its own; a screen reader hears it whole. */}
            <p className="room-tally-figure">
              <b aria-hidden="true">{new Intl.NumberFormat(words.locale).format(calls.waiting.length)}</b>
              <span className="sr-only">{`${new Intl.NumberFormat(words.locale).format(calls.waiting.length)} ${text.messagesNoun(calls.waiting.length)}`}</span>
            </p>
            {oldest && at !== undefined && (
              <span className="live-count help-oldest">{oldestWaiting(waited(oldest))}</span>
            )}
          </div>
        </div>
        {/* Each source says itself: the assistant's mark only where the assistant read the note, the rules' in plain words. */}
        {calls.waiting.some((call) => isFirst(call) && call.urgent?.by === "assistant") && (
          <p className="help-assistant help-first-origin">
            <Sparkles size={15} aria-hidden="true" /> {words.urgent.originAssistant}
          </p>
        )}
        {calls.waiting.some((call) => isFirst(call) && call.urgent?.by === "rules") && (
          <p className="help-assistant help-first-origin">{words.urgent.origin}</p>
        )}
        {calls.waiting.length ? (
          <div className="live-list">
            {calls.waiting.map((call) => (
              <div
                className="help-row"
                data-row-menu=""
                data-call={call.id}
                data-old={waited(call) >= 2 * DAY ? "" : undefined}
                key={call.id}
              >
                {leaf(call.takenAt)}
                <div>
                  <h3>
                    {call.neighborId ? (
                      // The whole row opens the record, through its one link, the name.
                      <Link className="help-row-open" href={recordHref(call.neighborId)}>
                        {caller(call, words)}
                      </Link>
                    ) : (
                      <span className="live-name">{caller(call, words)}</span>
                    )}
                    {call.phone && (
                      // The number calls: on a phone a tap rings it, and the row's menu offers it first as Call.
                      <a className="help-phone" href={`tel:${call.phone.replace(/[^\d+]/g, "")}`}>
                        {call.phone}
                      </a>
                    )}
                  </h3>
                  <p>{sampleSaid(call.note)}</p>
                  {call.urgent && call.urgent.by !== "person" && isFirst(call) && (
                    <p className="help-assistant help-first paper-rise">
                      {call.urgent.by === "assistant" && <Sparkles size={15} aria-hidden="true" />}
                      <strong>
                        {whyFirst(call.urgent, words).join(" · ") ||
                          words.urgent.label}
                      </strong>
                      {call.urgent.by === "assistant" && <UrgencyRead callId={call.id as Id<"calls">} />}
                    </p>
                  )}
                  {call.urgent?.by === "person" && call.urgent.byName && (
                    <p className="help-first help-moved paper-rise">
                      {isFirst(call) ? text.putFirstBy(call.urgent.byName) : text.notUrgentBy(call.urgent.byName)}
                    </p>
                  )}
                </div>
                <div className="live-row-actions">
                  <Button
                    variant="outline"
                    data-row-action=""
                    aria-label={text.markReturnedFor(caller(call, words))}
                    onClick={() => onStep({ kind: "return", call })}
                  >
                    {text.markReturned}
                  </Button>
                </div>
                {/* After "Mark returned" in the page itself, so a screen reader and the Tab key meet the row's main act first, as the eye does on a phone. */}
                <p className="help-facts help-row-more">
                  {call.ownerName && (
                    <span className="help-person">
                      <span className="help-initials" aria-hidden="true">
                        {initials(call.ownerName)}
                      </span>
                      {text.callingBack(call.ownerName)}
                    </span>
                  )}
                  {!call.openRequest && !draftedCallIds.includes(call.id) && (
                    <Button
                      variant="link"
                      className="help-text-action"
                      disabled={busy}
                      onClick={() => onStep({ kind: "draft", call })}
                    >
                      {reading === call.id ? text.drafting : text.draft}
                    </Button>
                  )}
                  {!call.neighborId && (
                    <Button
                      variant="link"
                      className="help-text-action"
                      onClick={() => onStep({ kind: "neighbor", call })}
                    >
                      {text.addNeighbor}
                    </Button>
                  )}
                  {/* Offered once, on the call that has waited longest, and on a call already put first. */}
                  {onFirst && (isFirst(call) || (call === oldest && !calls.waiting.some(isFirst))) && (
                    <Button
                      variant="link"
                      className="help-text-action"
                      onClick={() => onFirst(call, !isFirst(call))}
                    >
                      {isFirst(call)
                        ? words.urgent.notUrgent
                        : words.urgent.putFirst}
                    </Button>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // The head carries "Log a call": the quiet state does not ask twice.
          <HelpEmpty title={text.quietTitle}>
            {text.quiet}
          </HelpEmpty>
        )}
      </section>
      )}
      {calls.returned.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>{text.returnedThisWeek}</h2>
            <span className="live-count" data-returned-count>
              {text.count(calls.returned.length)}
            </span>
          </div>
          <div className="live-list">
            {calls.returned.map((call) => (
              <div
                className="help-row"
                data-quiet
                data-call={call.id}
                key={call.id}
              >
                {leaf(call.returnedAt ?? call.takenAt)}
                <div>
                  <h3>{caller(call, words)}</h3>
                  <p>{sampleSaid(call.outcome || call.note)}</p>
                </div>
                <span className="live-status help-returned">
                  {call.returnedByName ? text.returnedBy(call.returnedByName) : text.returned}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** While the assistant reads: the sheet is already laid down with the caller's words on it, and the rest arrives. */
function ReadingSheet({ note }: { note?: string }) {
  const text = useWorkspace().words.rooms.helpLine.reading;
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    sheet.current?.scrollIntoView({
      block: "nearest",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);
  return (
    <section
      className="help-sheet paper-rest help-reading"
      role="status"
      ref={sheet}
    >
      <p className="help-sheet-label">{text.label}</p>
      <div className="help-sheet-body">
        <div>
          <p className="help-reading-title">{text.title}</p>
          {note && <p className="help-quote">“{note}”</p>}
        </div>
      </div>
      <p className="help-assistant help-assistant-line">
        <Sparkles size={16} aria-hidden="true" />
        <span>
          {text.limits}
        </span>
      </p>
    </section>
  );
}
