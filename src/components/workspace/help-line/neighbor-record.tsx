"use client";

import { DateLeaf } from "@/components/workspace/primitives";

import "@/components/workspace/for-good.css";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { ArrowLeft, Lock, TriangleAlert } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace, type WayBack } from "@/components/workspace/context";
import { UndoAct } from "@/components/workspace/undo";
import { useFormsLater } from "@/components/workspace/help-line/forms-later";
import { sayFailure } from "@/components/workspace/failure";
import { openUp } from "@/components/workspace/fold";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveState } from "@/components/workspace/states";
import {
  AccountsForm,
  AtHome,
  MoneyForm,
  NoteForm,
  PeopleForm,
  type Accounts,
  type HomeStep,
} from "@/components/workspace/help-line/household";
import { fill } from "@/lib/words/fill";
import type { Words } from "@/lib/words";
import {
  money,
  shortMoney,
  type HelpRequest,
  type NeighborRecord as Record,
} from "@/components/workspace/help-line/format";
import {
  HelpDone,
  HelpEmpty,
  HelpLoading,
} from "@/components/workspace/help-line/room";
import { neighborsWords } from "@/lib/words/rooms/neighbors";

/** Other records that may be this household: fetched with the record's own code only once the record is on the page. */
const PossibleSame = lazy(() => import("@/components/workspace/help-line/possible-same").then((module) => ({ default: module.PossibleSame })));
// The printed request is fetched only when someone asks to print one.
/** The files kept with the record: fetched only once a record is open. */
const UploadedFiles = lazy(() => import("@/components/workspace/tools/uploaded-files"));
const RequestDetailView = lazy(() => import("@/components/workspace/help-line/request-detail").then((module) => ({ default: module.RequestDetailView })));

type Step =
  | { kind: "request" | "details" | "note" | "remove" | HomeStep }
  | { kind: "approve" | "decline" | "change" | "close"; request: HelpRequest };

function Back() {
  const { words } = useWorkspace();
  return (
    <Link className="help-back" href="/app/neighbors" scroll={false} data-step-own="">
      <ArrowLeft size={16} aria-hidden="true" /> {neighborsWords(words).all}
    </Link>
  );
}

/**
 * A request in a few words, in the person's language: a helper cannot ask for the person's words itself, so the
 * component that has them passes them here.
 */
function requestWords(words: Words) {
  const text = neighborsWords(words).request;
  const vouchers = (voucher: { item: string; quantity: number }) => {
    // The shelf may name its item "Clothing voucher" already; it is said once. The item stays as it was typed.
    const item = voucher.item.toLowerCase().replace(/\s+vouchers?$/, "");
    return { item, quantity: voucher.quantity, said: fill(text.vouchers(voucher.quantity), { item }) };
  };
  return {
    vouchers,
    title: (request: HelpRequest) => {
      if (request.voucher) return vouchers(request.voucher).said;
      const kind = words.kinds[request.kind];
      const amount = shortMoney(request.amountApproved ?? request.amountRequested);
      return request.payeeName ? fill(text.amountTo, { kind, amount, payee: request.payeeName }) : fill(text.amount, { kind, amount });
    },
  };
}

/** A reveal of the account numbers that was refused: the sentence to show, and which try it was. */
type Covered = { why: string; tries: number };

/**
 * The account numbers were asked for and did not come. Said in plum, where the person asked: on the
 * record above "At home", or inside the Accounts dialog when that is open (never behind it). It is not
 * a saved line, so it carries no tick and does not go away by itself. It opens its own room (fold.ts),
 * so what is under it is moved aside and does not jump. Because it stays, it is never held fixed over the
 * record: laid above the window it takes its place in the page at once. It takes focus, so a screen reader says it
 * and the keyboard is never left on a button that did nothing. A second refusal changes no words, so
 * it is the focus coming back that says it again.
 */
function StillCovered({
  covered,
  kept,
  onPage = false,
}: {
  covered: Covered;
  /** The second line: what is still as it was. */
  kept: string;
  /** On the record itself the notice stands clear of what is above it; a dialog spaces its own pieces. */
  onPage?: boolean;
}) {
  const notice = useRef<HTMLDivElement>(null);
  // Before it is first painted, so it is never seen at full height first.
  useLayoutEffect(() => {
    if (notice.current) openUp(notice.current, { stays: true });
  }, []);
  useEffect(() => {
    notice.current?.focus({ preventScroll: true });
    notice.current?.scrollIntoView({ block: "nearest" });
  }, [covered.tries]);
  return (
    <div
      className="live-error live-failure"
      role="alert"
      tabIndex={-1}
      ref={notice}
      style={onPage ? { marginTop: 24 } : undefined}
    >
      <div>
        <p>{covered.why}</p>
        <p className="live-error-recovery">{kept}</p>
      </div>
    </div>
  );
}

/** A short phrase whose words stay on one line (a long one, past 32 letters, is left free to wrap). */
const keepPhrase = (phrase: string | undefined) =>
  phrase && phrase.length <= 32 ? phrase.replace(/ /g, "\u00a0") : phrase;

/** Opens one record: the opening is written down first, and only then is the record read. */
export function NeighborRecord({
  neighborId,
  requestId,
}: {
  neighborId: Id<"neighbors">;
  /** From a link to one request: that request is the one on the sheet. */
  requestId?: string | null;
}) {
  const { data, format, now, setHeading, words, sampleSaid } = useWorkspace();
  const text = neighborsWords(words).record;
  const { title: requestTitle } = requestWords(words);
  const churchId = data.church.id;
  const open = useMutation(api.neighbors.open);
  const asked = useRef(false);
  // The audit line the opening wrote; the record is read with it, and refused without it.
  const [opened, setOpened] = useState<
    "waiting" | "missing" | { line: Id<"auditEvents"> }
  >("waiting");
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    open({ churchId, neighborId }).then(
      (line) => setOpened({ line }),
      () => setOpened("missing"),
    );
  }, [open, churchId, neighborId]);
  // While a removal is on its way the record is no longer read, so the screen never asks for
  // one that has just gone; it shows the record as it last was. If the removal is refused,
  // that last reading stays on the screen until the fresh one arrives, so the sheet and what
  // it says are never taken down.
  const [held, setHeld] = useState<Record | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const live = useQuery(
    api.neighbors.record,
    typeof opened === "object" && !removing && !removed
      ? { churchId, neighborId, opening: opened.line }
      : "skip",
  );
  const read = removed ? undefined : (live ?? held ?? undefined);
  const record = read && {
    ...read,
    open: [...read.open].sort(
      (a, b) => Number(b.id === requestId) - Number(a.id === requestId),
    ),
  };
  const title = record?.neighbor.name;
  const size = record ? record.neighbor.adults + record.neighbor.children : 0;
  const deck =
    record &&
    [
      // One quiet line under the name: where they live, who lives there, the language. The phone and the
      // email stay under At home, where they are changed.
      record.neighbor.address,
      // The short phrases hold together, so a wrap never parts "speaks" from the language ("habla / inglés").
      keepPhrase(size === 1 ? text.deck.livesAlone : text.deck.householdOf(size)),
      // The name recorded for another language stays as it was typed.
      keepPhrase(
        record.neighbor.language === "other" && record.neighbor.languageName
          ? text.deck.speaksNamed(record.neighbor.languageName)
          : text.deck.speaks[record.neighbor.language],
      ),
      text.deck.since(format(record.since, { day: undefined, month: "long", year: "numeric" })),
    ]
      .filter(Boolean)
      // The dot holds to the words before it, so a wrapped line never opens on one.
      .join("\u00a0· ");
  // One request laid out to print, in place of the record; the way back returns to the record.
  const [printing, setPrinting] = useState<HelpRequest["id"] | null>(null);
  // The record's page head is the neighbor's name, with no painting: private and plain.
  useLayoutEffect(() => {
    if (!title || !deck) return;
    setHeading(printing ? { title, deck, plain: true, back: { label: title, run: () => setPrinting(null) } } : { title, deck, plain: true });
    return () => setHeading(null);
  }, [setHeading, title, deck, printing]);
  const [step, setStep] = useState<Step | null>(null);
  const forms = useFormsLater(step !== null);
  const [done, setDone] = useState("");
  const showAccounts = useMutation(api.neighbors.showAccounts);
  const [numbers, setNumbers] = useState<Accounts | null>(null);
  // A refused reveal is its own plum notice, never the green saved line: nothing was done. It is said where
  // the person asked, and it is taken down when they move on (a dialog opened, closed or saved), so it is
  // never carried from the dialog onto the page behind it, or the other way.
  const [covered, setCovered] = useState<Covered | null>(null);
  // Counts each time the person moves on. A refusal that arrives after that belongs to a place they have left
  // (the dialog, or the page behind it), so it is dropped and never said somewhere it was not asked.
  const place = useRef(0);
  const moveOn = () => {
    place.current += 1;
    setCovered(null);
  };
  // The request given its yes in this visit: its corner turns over to green as the record shows it approved.
  const [approvedNow, setApprovedNow] = useState<HelpRequest["id"] | null>(null);
  const finish = (message: string, back?: WayBack) => {
    setStep(null);
    moveOn();
    setDone(message);
    setBack(back);
    setUndoRefused("");
  };
  // The way back from the step just taken, while its line is up; and an undo the server would not take, in plum.
  const [back, setBack] = useState<WayBack>();
  const [undoRefused, setUndoRefused] = useState("");
  const takeBackNote = useMutation(api.neighbors.takeBackNote);
  const undoDecision = useMutation(api.assistance.undoDecision);
  const close = () => {
    setStep(null);
    moveOn();
  };
  const reveal = () => {
    const askedAt = place.current;
    return showAccounts({ churchId, neighborId }).then(
      (shown) => {
        setCovered(null);
        setNumbers(shown);
      },
      (cause: unknown) => {
        if (place.current !== askedAt) return;
        // The backend's own sentence when it gives one. The notice stays up while a second try is on its way.
        setCovered((before) => ({
          why: sayFailure(
            words.notices,
            cause,
            text.numbers.refused,
            text.numbers.offline,
          ),
          tries: (before?.tries ?? 0) + 1,
        }));
      },
    );
  };
  const target = { churchId, neighborId };
  if (opened === "missing")
    return (
      <HelpEmpty
        first
        title={text.missing.title}
        action={
          <Button variant="outline" asChild>
            <Link href="/app/neighbors" scroll={false} data-step-own="">{neighborsWords(words).all}</Link>
          </Button>
        }
      >
        {text.missing.body}
      </HelpEmpty>
    );
  if (removed)
    return (
      <LiveState
        kind="empty"
        title={text.removed.title}
        action={
          <Button variant="outline" asChild>
            <Link href="/app/neighbors" scroll={false} data-step-own="">{neighborsWords(words).all}</Link>
          </Button>
        }
      >
        {text.removed.body}
      </LiveState>
    );
  if (!record) return <HelpLoading />;
  const { neighbor } = record;
  if (printing)
    return (
      <Suspense fallback={<HelpLoading />}>
        <RequestDetailView
          neighbor={{
            name: neighbor.name,
            address: neighbor.address,
            phone: neighbor.phone,
            householdSize: neighbor.adults + neighbor.children,
            speaks: neighbor.language === "other" ? neighbor.languageName || neighborsWords(words).languages.other : neighborsWords(words).languages[neighbor.language],
            alert: neighbor.alert,
          }}
          rows={record.requests}
          requestId={printing}
          visit={null}
        />
      </Suspense>
    );
  return (
    <>
      {undoRefused && !done && (
        <div className="live-error" role="alert">
          <p>{undoRefused}</p>
        </div>
      )}
      {done && (
        <HelpDone
          key={done}
          action={back && (
            <UndoAct
              run={async () => {
                // Undo stays (asleep) until the reverse answers, so focus has somewhere to be meanwhile.
                try {
                  await back.run();
                  setBack(undefined);
                  setDone(back.said);
                } catch (cause) {
                  setBack(undefined);
                  setDone("");
                  setUndoRefused(sayFailure(words.notices,cause, words.notices.failed));
                }
              }}
            />
          )}
        >
          {done}
        </HelpDone>
      )}
      <NeighborRecordView
        record={record}
        format={format}
        now={now}
        numbers={numbers}
        // Under an open dialog the page says nothing: the dialog says it.
        covered={step ? null : covered}
        approvedNow={approvedNow}
        onPrint={setPrinting}
        files={typeof opened === "object" && !removing && !removed ? (
          <Suspense fallback={null}>
            <UploadedFiles neighborId={neighborId} opening={opened.line} />
          </Suspense>
        ) : null}
        onShowNumbers={() => void reveal()}
        alike={<Suspense><PossibleSame neighborId={neighborId} onMerged={(said) => finish(said)} /></Suspense>}
        onStep={(next) => {
          setDone("");
          moveOn();
          setStep(next);
        }}
      />
      {step?.kind === "people" && (
        <LiveDialog
          title={text.sheets.people.title}
          description={text.sheets.people.about(neighbor.name)}
          onClose={close}
        >
          <PeopleForm
            target={target}
            household={record.household}
            onSaved={() => finish(text.done.household)}
          />
        </LiveDialog>
      )}
      {step?.kind === "money" && (
        <LiveDialog
          title={text.sheets.money.title}
          description={text.sheets.money.about}
          onClose={close}
        >
          <MoneyForm
            target={target}
            money={record.money}
            onSaved={() => finish(text.done.month)}
          />
        </LiveDialog>
      )}
      {step?.kind === "accounts" && (
        <LiveDialog
          title={text.sheets.accounts.title}
          description={text.sheets.accounts.about}
          onClose={close}
        >
          {/* Above the form: under it, the form's pinned buttons would lie over the notice. It is brought into view. */}
          {covered && (
            <StillCovered
              covered={covered}
              kept={text.numbers.keptInForm}
            />
          )}
          <AccountsForm
            target={target}
            accounts={record.accounts}
            numbers={numbers}
            onShowNumbers={() => void reveal()}
            onSaved={() => {
              setNumbers(null);
              finish(text.done.accounts);
            }}
          />
        </LiveDialog>
      )}
      {step?.kind === "note" && (
        <LiveDialog
          title={text.sheets.note.title}
          description={text.sheets.note.about(neighbor.name)}
          onClose={close}
        >
          <NoteForm target={target} onSaved={(noteId) => finish(text.done.note, { run: () => takeBackNote({ churchId: target.churchId, noteId }), said: text.done.noteTakenBack })} />
        </LiveDialog>
      )}
      {step?.kind === "request" && forms && (
        <LiveDialog
          title={text.sheets.request.title}
          description={text.sheets.request.about(neighbor.name)}
          onClose={close}
        >
          <forms.RequestForm
            churchId={churchId}
            neighborId={neighbor.id}
            onSaved={() =>
              finish(text.done.request)
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "change" && forms && (
        <LiveDialog
          title={text.sheets.change.title}
          description={text.sheets.change.about}
          onClose={close}
        >
          <forms.RequestForm
            churchId={churchId}
            neighborId={neighbor.id}
            request={step.request}
            onSaved={() => finish(text.done.changed)}
          />
        </LiveDialog>
      )}
      {(step?.kind === "approve" || step?.kind === "decline") && forms && (
        <LiveDialog
          title={
            step.kind === "approve" ? text.sheets.approve : text.sheets.decline
          }
          description={`${requestTitle(step.request)}. ${sampleSaid(step.request.summary)}`}
          onClose={close}
        >
          <forms.DecideForm
            churchId={churchId}
            request={step.request}
            decision={step.kind === "approve" ? "approved" : "declined"}
            onSaved={() => {
              if (step.kind === "approve") setApprovedNow(step.request.id);
              finish(step.kind === "approve" ? text.done.approved(neighbor.name) : text.done.declined(neighbor.name), step.request.voucher ? undefined : { run: () => undoDecision({ churchId, requestId: step.request.id }), said: text.done.undone(neighbor.name) });
            }}
          />
        </LiveDialog>
      )}
      {step?.kind === "close" && forms && (
        <LiveDialog
          title={
            forms.takingBack(step.request) ? text.sheets.takeBack : text.sheets.close
          }
          description={`${requestTitle(step.request)}. ${sampleSaid(step.request.summary)}`}
          onClose={close}
        >
          <forms.CloseForm
            churchId={churchId}
            request={step.request}
            onSaved={() =>
              forms.takingBack(step.request) ? finish(text.done.takenBack(neighbor.name)) : finish(text.done.closed(neighbor.name), { run: () => undoDecision({ churchId, requestId: step.request.id }), said: text.done.undone(neighbor.name) })
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "remove" && forms && (
        <LiveDialog
          title={text.sheets.remove.title}
          description={text.sheets.remove.about(neighbor.name)}
          onClose={close}
        >
          <forms.RemoveForm
            churchId={churchId}
            neighbor={neighbor}
            onBegin={() => {
              setHeld(read ?? null);
              setRemoving(true);
            }}
            onRefused={() => setRemoving(false)}
            onRemoved={() => {
              setStep(null);
              setRemoved(true);
            }}
          />
        </LiveDialog>
      )}
      {step?.kind === "details" && forms && (
        <LiveDialog
          title={text.sheets.details.title}
          description={text.sheets.details.about(neighbor.name)}
          onClose={close}
        >
          <forms.NeighborForm
            churchId={churchId}
            neighbor={neighbor}
            onSaved={() => finish(text.done.details)}
          />
        </LiveDialog>
      )}
    </>
  );
}

function happened(event: Record["history"][number], now: number, words: Words) {
  const text = neighborsWords(words).record.history;
  const kinds: { [kind: string]: string | undefined } = words.kinds;
  switch (event.type) {
    case "payment":
      return {
        kind: "money",
        // A category that is not one of the kinds of help is said as it was written down.
        what: fill(text.paidTo, { kind: kinds[event.category] ?? event.category, payee: event.payee }),
        who: text.recordedBy(event.who),
        paid: shortMoney(event.amount),
      };
    case "visit":
      return {
        kind: "visit",
        what: text.visit,
        // Each name whole, as it was written; no one went means nothing is said.
        who: event.who.length ? event.who.reduce((first, second) => fill(text.pair, { first, second })) : "",
        found: event.note,
      };
    case "call":
      return {
        kind: "call",
        what: event.note || text.called,
        who: text.callTakenBy(event.who),
      };
    case "note":
      return { kind: "note", what: event.note, who: text.noteBy(event.who) };
    case "brought":
      return {
        kind: "money",
        what: event.payee ? fill(text.paidTo, { kind: words.kinds[event.kind], payee: event.payee }) : words.kinds[event.kind],
        who: text.broughtOver,
        paid: event.amount ? shortMoney(event.amount) : undefined,
      };
    case "voucher": {
      const { item, quantity } = requestWords(words).vouchers(event);
      return {
        kind: event.takenBack ? "closed" : "money",
        what: fill(event.takenBack ? text.vouchersTakenBack(quantity) : text.vouchersGiven(quantity), { item }),
        who: [
          event.closedBy && text.takenBackBy(event.closedBy),
          text.approvedBy(event.who),
        ]
          .filter(Boolean)
          .join(" · "),
        found: event.note,
        // The backend says until when and never reads the clock in a query; taking it back is checked there by the real one.
        takeBack: event.takeBackUntil !== null && now <= event.takeBackUntil ? event.requestId : undefined,
      };
    }
    case "decision":
      if (event.status === "closed")
        return {
          kind: "closed",
          // Never "without help" once money went out; each payment keeps its own line.
          what: event.paid
            ? fill(text.closedAfter, { kind: words.kinds[event.kind], paid: shortMoney(event.paid), approved: shortMoney(event.approved) })
            : fill(text.closedWithout, { kind: words.kinds[event.kind] }),
          who: [
            event.who && text.closedBy(event.who),
            event.approvedBy && text.approvedBy(event.approvedBy),
          ]
            .filter(Boolean)
            .join(" · "),
          found: event.note,
        };
      return {
        kind: "call",
        what: fill(text.declined, { kind: words.kinds[event.kind] }),
        who: [event.note, text.decidedBy(event.who)].filter(Boolean).join(" "),
      };
  }
}

function NeighborRecordView({
  record,
  format,
  now,
  numbers = null,
  covered = null,
  approvedNow = null,
  onShowNumbers = () => {},
  alike = null,
  onPrint,
  onStep,
  files = null,
}: {
  /** Other records that may be the same household, laid under the home's details. */
  alike?: ReactNode;
  record: Record;
  format: Workspace["format"];
  /** The page's own clock, for what depends on the time, such as whether a voucher may still be taken back. */
  now: number;
  numbers?: Accounts | null;
  /** "Show numbers" was refused: said in plum just above "At home", where it was asked. */
  covered?: Covered | null;
  /** The request given its yes in this visit, whose corner turns over to green as it is shown approved. */
  approvedNow?: HelpRequest["id"] | null;
  onShowNumbers?: () => void;
  /** Lays one request out as a printed page, for a home visit. */
  onPrint?: (requestId: HelpRequest["id"]) => void;
  onStep: (step: Step) => void;
  /** The files kept with the record, drawn just above who opened it. */
  files?: ReactNode;
}) {
  const { words, sampleSaid } = useWorkspace();
  const text = neighborsWords(words).record;
  const { title: requestTitle } = requestWords(words);
  const { neighbor, open } = record;
  const [first, ...alsoOpen] = open;
  const year = (at: number) =>
    format(at, { month: undefined, day: undefined, year: "numeric" });
  const asked = (request: HelpRequest) =>
    request.source === "import"
      ? fill(text.sheet.brought, { date: format(request.createdAt, { weekday: undefined, year: "numeric" }) })
      : fill(text.sheet.asked, {
          date: format(request.createdAt, { weekday: "long", month: "long", day: "numeric" }),
          name: request.createdByName,
        });
  const years = [...new Set(record.history.map((event) => year(event.at)))];
  return (
    <>
      <p className="help-record-head">
        <Back />
      </p>
      {neighbor.alert && (
        <p className="help-alert" role="note">
          <TriangleAlert size={18} aria-hidden="true" /> {sampleSaid(neighbor.alert)}
        </p>
      )}

      <dl className="help-figures">
        <div>
          <dt>{text.figures.year}</dt>
          <dd>
            <span className="count-up">{shortMoney(Math.round(record.paidThisYear / 100) * 100)}</span>
            <small>{text.figures.requests(record.requestsThisYear)}</small>
          </dd>
        </div>
        <div>
          <dt>{text.figures.visits}</dt>
          <dd>
            {record.visitsDone}
            <small>
              {record.lastVisitAt
                ? text.figures.lastVisit(format(record.lastVisitAt))
                : text.figures.noVisits}
            </small>
          </dd>
        </div>
        <div>
          <dt>{text.figures.open}</dt>
          <dd>
            {open.length}
            <small>
              {first
                ? fill(neighborsWords(words).request.amount, {
                    kind: words.kinds[first.kind],
                    amount: shortMoney(first.amountApproved ?? first.amountRequested),
                  })
                : text.figures.nothingOpen}
            </small>
          </dd>
        </div>
      </dl>

      {neighbor.notes && <p className="help-note">{sampleSaid(neighbor.notes)}</p>}

      {first && (
        <section
          className={first.status === "approved" ? `help-sheet help-decided paper-fold${first.id === approvedNow ? " help-approved" : ""}` : "help-sheet help-decided"}
          aria-labelledby="open-title"
        >
          <p className="help-sheet-label" data-waiting="">
            {first.status === "open" ? text.sheet.open : text.sheet.approved}
          </p>
          <div className="help-sheet-body">
            <div>
              <h2 id="open-title">{requestTitle(first)}</h2>
              <p className="help-why">{sampleSaid(first.summary)}</p>
              <p>
                {asked(first)}
                {first.status === "approved" &&
                  ` ${fill(text.sheet.approvedBy, { name: first.decidedByName ?? "", amount: money(first.amountApproved ?? 0), payee: first.payeeName })}`}
              </p>
              {onPrint && (
                <Button variant="link" className="help-text-action help-sheet-print" onClick={() => onPrint(first.id)}>
                  {words.locale === "es" ? "Imprimir petición" : "Print request"}
                </Button>
              )}
            </div>
            {first.status === "approved" && (
              <div className="help-actions">
                {/* Paid often days later, by someone else: the way to record it stays on the request until it is paid. */}
                {(first.amountApproved ?? 0) > 0 && (
                  <Link className="live-link" href={`/app/treasury?pay=${first.id}`}>
                    {text.done.pay}
                  </Link>
                )}
                <Button
                  variant="link"
                  className="help-text-action"
                  onClick={() => onStep({ kind: "close", request: first })}
                >
                  {text.sheet.close}
                </Button>
              </div>
            )}
            {first.status === "open" && (
              <div className="help-actions">
                <Button
                  onClick={() => onStep({ kind: "approve", request: first })}
                >
                  {text.sheet.approve}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onStep({ kind: "decline", request: first })}
                >
                  {text.sheet.decline}
                </Button>
                <Button
                  variant="link"
                  className="help-text-action"
                  onClick={() => onStep({ kind: "change", request: first })}
                >
                  {text.sheet.change}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
      {alsoOpen.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>{text.also.title}</h2>
            <span className="live-count">{text.also.count(alsoOpen.length)}</span>
          </div>
          <div className="live-list">
            {alsoOpen.map((request) => (
              <div className="help-row help-also-row" key={request.id}>
                <DateLeaf said={format(request.createdAt, { month: "long", day: "numeric" })}>
                  <span>{format(request.createdAt, { day: undefined })}</span>
                  <strong>
                    {format(request.createdAt, { month: undefined })}
                  </strong>
                </DateLeaf>
                <div>
                  <h3>{requestTitle(request)}</h3>
                  <p>
                    {sampleSaid(request.summary)}
                    {/* A summary typed without a closing stop still ends its sentence before the note that follows. */}
                    {request.source === "import" && `${/(^|[.!?…])\s*$/.test(sampleSaid(request.summary)) ? "" : "."} ${text.also.brought}`}
                  </p>
                </div>
                <div className="live-row-actions">
                  {request.status === "open" ? (
                    <Button
                      variant="outline"
                      aria-label={text.also.approveThis(requestTitle(request))}
                      onClick={() => onStep({ kind: "approve", request })}
                    >
                      {text.sheet.approve}
                    </Button>
                  ) : (
                    <span className="live-status">{text.sheet.approved}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What is open leads, under the figures; the home's details follow it, then the thread. */}
      {covered && (
        <StillCovered
          covered={covered}
          kept={text.numbers.keptOnPage}
          onPage
        />
      )}
      <AtHome
        record={record}
        format={format}
        numbers={numbers}
        onShowNumbers={onShowNumbers}
        onStep={(kind) => onStep({ kind })}
      />
      {alike}

      <section
        className={first || alsoOpen.length ? "live-section help-history" : "help-history"}
      >
        <div className="live-section-head">
          <h2>{text.history.title}</h2>
          <span className="help-head-actions">
            <Button
              variant="link"
              className="help-text-action"
              onClick={() => onStep({ kind: "note" })}
            >
              {text.history.note}
            </Button>
            {!first && (
              <Button
                variant="outline"
                onClick={() => onStep({ kind: "request" })}
              >
                {text.history.request}
              </Button>
            )}
          </span>
        </div>
        {record.history.length ? (
          years.map((label) => (
            <div key={label}>
              <p className="help-year">{label}</p>
              <ol className="help-timeline">
                {record.history
                  .filter((event) => year(event.at) === label)
                  .map((event, index) => {
                    const line = happened(event, now, words);
                    const given =
                      "takeBack" in line &&
                      record.requests.find(
                        (request) => request.id === line.takeBack,
                      );
                    return (
                      <li key={`${event.at}-${index}`} data-kind={line.kind}>
                        <time>{format(event.at)}</time>
                        <i aria-hidden="true" />
                        <div>
                          <h3>{line.what}</h3>
                          {"found" in line && line.found && (
                            <p className="help-found">{line.found}</p>
                          )}
                          <p>
                            {line.who}
                            {given && (
                              <>
                                <span className="help-sep"> · </span>
                                <Button
                                  variant="link"
                                  className="help-text-action"
                                  aria-label={text.history.takeBackThis(line.what)}
                                  onClick={() =>
                                    onStep({ kind: "close", request: given })
                                  }
                                >
                                  {text.history.takeBack}
                                </Button>
                              </>
                            )}
                          </p>
                        </div>
                        {"paid" in line && line.paid && (
                          <span className="help-amount">{line.paid}</span>
                        )}
                      </li>
                    );
                  })}
              </ol>
            </div>
          ))
        ) : (
          <HelpEmpty title={text.history.empty.title}>
            {text.history.empty.body}
          </HelpEmpty>
        )}
      </section>

      {files}

      <section className="live-section">
        <div className="live-section-head">
          <h2>{text.openings.title}</h2>
          <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" /> {text.openings.who}
          </span>
        </div>
        <Openings openings={record.openings} text={text.openings} format={format} />
      </section>

      {record.mayRemove && (
        <p className="for-good">
          <Button
            variant="ghost"
            className="for-good-open"
            onClick={() => onStep({ kind: "remove" })}
          >
            {text.remove.open}
          </Button>
          <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" /> {text.remove.who}
          </span>
        </p>
      )}
    </>
  );
}

/** One line per person per day, ten at first: a record opened twenty times by one person is one fact, not twenty. */
function Openings({ openings, text, format }: { openings: Record["openings"]; text: ReturnType<typeof neighborsWords>["record"]["openings"]; format: Workspace["format"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? openings : openings.slice(0, 10);
  return (
    <div className="help-opened">
      <ul>
        {shown.map((opening) => (
          <li key={`${opening.who}-${opening.at}`}>
            <strong>{opening.who}</strong> ·{" "}
            {fill(text.day(opening.count), { day: format(opening.at, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).replace(/ /g, "\u00a0"), time: format(opening.at, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" }).replace(" ", "\u00a0") })}
          </li>
        ))}
      </ul>
      {!all && openings.length > 10 && (
        <Button variant="ghost" className="help-opened-all" onClick={() => setAll(true)}>{text.all(openings.length)}</Button>
      )}
    </div>
  );
}
