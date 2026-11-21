"use client";

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { ArrowLeft, Lock, Printer } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { sayFailure } from "@/components/workspace/failure";
import { HelpLoading } from "@/components/workspace/help-line/room";
import { LiveFailure } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import { TimeForm } from "@/components/workspace/visits/forms";
import { fill } from "@/lib/words/fill";
import type { Words } from "@/lib/words";
import { capital, firstName, need, spoken, together, useVisitDates, type Sheet } from "@/components/workspace/visits/format";

// The printed request is fetched only when someone asks to print one.
const RequestDetailFromVisit = lazy(() => import("@/components/workspace/help-line/request-detail").then((module) => ({ default: module.RequestDetailFromVisit })));

/**
 * What the pair carries to the door, made to be printed.
 * Opening it shows a neighbor's details, so it is written down first, like opening the record.
 */
export function VisitSheet({ visitId }: { visitId: Id<"visits"> }) {
  const { data, now, setHeading, words, offerUndo, sampleSaid } = useWorkspace();
  const reinstate = useMutation(api.visits.reinstate);
  const text = words.rooms.visitsRoom.sheet;
  const format = useVisitDates();
  const churchId = data.church.id;
  // One neighbor's details: a plain head, with no painting.
  const { title, deck, didNotOpen } = text;
  const notices = words.notices;
  // The request this visit answers, laid out to print in place of the sheet; the way back returns to the sheet.
  const [printing, setPrinting] = useState(false);
  useLayoutEffect(() => {
    setHeading(printing ? { title, deck, back: { label: title, run: () => setPrinting(false) } } : { title, deck });
    return () => setHeading(null);
  }, [setHeading, title, deck, printing]);
  const router = useRouter();
  const openSheet = useMutation(api.visits.openSheet);
  const cancel = useMutation(api.visits.cancel);
  // The audit line the opening wrote; the sheet is read with it, and refused without it.
  const [opened, setOpened] = useState<Id<"auditEvents"> | null>(null);
  const [step, setStep] = useState<"callOff" | "time" | null>(null);
  const confirming = step === "callOff";
  const setConfirming = (open: boolean) => setStep(open ? "callOff" : null);
  const { pending, error, save } = useSave();
  // Each try at opening has a number. A refusal keeps the number of the try it answers, so the room knows
  // whether the notice on the page is the last word or a new try is already on its way.
  const [attempt, setAttempt] = useState(0);
  const [refused, setRefused] = useState<{ sentence: string; attempt: number } | null>(null);
  useEffect(() => {
    let current = true;
    void openSheet({ churchId, visitId }).then(
      (line) => {
        if (!current) return;
        setRefused(null);
        // A sheet already read keeps the line it was read with, so a second opening never makes it load again.
        setOpened((before) => before ?? line);
      },
      // Without this the quiet "Opening…" line would stay for ever, saying something is on its way when nothing is.
      (cause: unknown) => {
        if (current) setRefused({ sentence: sayFailure(notices, cause, didNotOpen), attempt });
      },
    );
    return () => {
      current = false;
    };
  }, [openSheet, churchId, visitId, attempt, didNotOpen, notices]);
  const sheet = useQuery(
    api.visits.sheet,
    opened ? { churchId, visitId, opening: opened } : "skip",
  );
  // The sheet that opens on a second try takes the place of the notice, and of the Try again that had the
  // focus. The focus goes to the first thing on the sheet, the way back, and not to the page.
  const arrived = Boolean(sheet);
  const afterRefusal = useRef(false);
  useEffect(() => {
    if (refused) afterRefusal.current = true;
    if (!arrived || !afterRefusal.current) return;
    afterRefusal.current = false;
    const at = document.activeElement;
    if (!at || at === document.body) document.querySelector<HTMLElement>(".visits-back")?.focus({ preventScroll: true });
  }, [arrived, refused]);
  // The sheet is drawn whole or not at all. When it did not open, its place says so in plum, with the way back
  // and one Try again. The notice stays while a second try is on its way (a press during it is not a third try),
  // and a second refusal lays it afresh, so it takes the focus and is said again even when the words are the same.
  // While that try is on its way one quiet line says so and Try again is marked at rest, so it never looks broken.
  if (!sheet && refused)
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (refused.attempt === attempt) setAttempt(attempt + 1);
        }}
      >
        <div className="visits-sheet-bar">
          <div className="visits-sheet-links">
            <Link className="visits-back" href="/app/visits">
              <ArrowLeft size={17} aria-hidden="true" /> {words.rooms.visitsRoom.name}
            </Link>
          </div>
        </div>
        <DidNotOpen
          key={refused.attempt}
          sentence={refused.sentence}
          trying={refused.attempt !== attempt}
          tryAgain={words.states.tryAgain}
          recovery={text.recovery}
          opening={text.openingAgain}
        />
      </form>
    );
  if (!sheet) return <HelpLoading label={text.opening} />;
  if (printing && sheet.request && opened)
    return (
      <Suspense fallback={<HelpLoading />}>
        <RequestDetailFromVisit
          churchId={churchId}
          neighborId={sheet.neighborId}
          requestId={sheet.request.id}
          opening={opened}
          neighbor={{
            name: sheet.neighbor.name,
            address: sheet.neighbor.address,
            phone: sheet.neighbor.phone,
            householdSize: sheet.neighbor.adults + sheet.neighbor.children,
            speaks: spoken(words.rooms.visitsRoom, sheet.neighbor),
            alert: sheet.neighbor.alert,
          }}
          visit={{ at: sheet.scheduledAt, visitors: sheet.visitors }}
        />
      </Suspense>
    );
  return (
    <>
      <VisitSheetView
        sheet={sheet}
        format={format}
        words={words}
        printed={format(now, { month: "long", day: "numeric", year: "numeric" })}
        sample={data.church.sample}
        say={sampleSaid}
        onPrint={() => window.print()}
        onPrintRequest={sheet.request ? () => setPrinting(true) : undefined}
        onCallOff={() => setStep("callOff")}
        onChangeTime={() => setStep("time")}
      />
      {step === "time" && (
        <LiveDialog
          title={text.changeTime}
          description={
            sheet.visitors.length > 1
              ? fill(text.askedAgainTwo, { first: sheet.visitors[0], second: sheet.visitors[1] })
              : sheet.visitors.length
                ? text.askedAgainOne(sheet.visitors[0])
                : text.newTime
          }
          onClose={() => setStep(null)}
        >
          <TimeForm
            churchId={churchId}
            visitId={visitId}
            at={DateTime.fromMillis(sheet.scheduledAt, {
              zone: data.church.timeZone,
            }).toFormat("yyyy-MM-dd'T'HH:mm")}
            onSaved={() => setStep(null)}
          />
        </LiveDialog>
      )}
      {confirming && (
        <LiveDialog
          title={text.callOffTitle}
          description={text.callOffDeck(sheet.neighbor.name)}
          onClose={() => setConfirming(false)}
        >
          <p className="visits-consequence">
            {sheet.visitors.length > 1
              ? fill(text.tellTwo, {
                  first: sheet.visitors[0],
                  second: sheet.visitors[1],
                  firstShort: firstName(sheet.visitors[0]),
                  secondShort: firstName(sheet.visitors[1]),
                })
              : sheet.visitors.length
                ? fill(text.tellOne, { name: sheet.visitors[0], short: firstName(sheet.visitors[0]) })
                : text.tellNoOne}
          </p>
          {error && <LiveFailure message={error} kept="" />}
          <div className="live-form-actions">
            <Button
              disabled={pending}
              onClick={async () => {
                const outcome = await save(() => cancel({ churchId, visitId }));
                if (!outcome.saved) return;
                const name = sheet.neighbor.name;
                offerUndo(text.calledOff(name), {
                  run: () => reinstate({ churchId, visitId }),
                  said: text.plannedAgain(name),
                });
                router.push("/app/visits");
              }}
            >
              {text.callOff}
            </Button>
          </div>
        </LiveDialog>
      )}
    </>
  );
}

/**
 * The sheet did not open. The same plum notice a form shows (LiveFailure), written out here because its
 * Try again must rest while a new try is already on its way: marked off, not removed, so the focus stays on it.
 */
function DidNotOpen({ sentence, trying, tryAgain, recovery, opening }: { sentence: string; trying: boolean; tryAgain: string; recovery: string; opening: string }) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    notice.current?.focus({ preventScroll: true });
    notice.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <>
      <div className="live-error live-failure" role="alert" tabIndex={-1} ref={notice}>
        <div>
          <p>{sentence}</p>
          <p className="live-error-recovery">{recovery}</p>
        </div>
        <Button type="submit" variant="outline" className="aria-disabled:opacity-50" aria-disabled={trying || undefined}>
          {tryAgain}
        </Button>
      </div>
      {trying && (
        <p className="live-waiting" role="status" style={{ marginTop: 12 }}>
          {opening}
        </p>
      )}
    </>
  );
}

const lines = (n: number) =>
  Array.from({ length: n }, (_, index) => <i key={index} />);

function VisitSheetView({
  sheet,
  format,
  words,
  printed,
  sample,
  say,
  onPrint,
  onPrintRequest,
  onCallOff,
  onChangeTime,
}: {
  sheet: Sheet;
  format: Workspace["format"];
  /** The person's own words: the view asks for nothing itself. */
  words: Words;
  onPrint: () => void;
  /** Today's date, for the foot of the printed page. */
  printed: string;
  /** The sample conference's sheets say so on paper, so a made-up household is never taken for a real one. */
  sample?: boolean;
  /** How the sample's own words are said to this reader; anything typed comes back as typed. */
  say: (typed: string) => string;
  /** Lays the request this visit answers out as its own printed page, with the help given before. */
  onPrintRequest?: () => void;
  onCallOff: () => void;
  onChangeTime: () => void;
}) {
  const { neighbor, request } = sheet;
  const room = words.rooms.visitsRoom;
  const text = room.sheet;
  const household = neighbor.children
    ? fill(text.adultsAndChildren, { adults: text.adults(neighbor.adults), children: text.children(neighbor.children) })
    : text.adults(neighbor.adults);
  return (
    <>
      <div className="visits-sheet-bar">
        <div className="visits-sheet-links">
          <Link className="visits-back" href="/app/visits">
            <ArrowLeft size={17} aria-hidden="true" /> {room.name}
          </Link>
          {sheet.status === "scheduled" && (
            <>
              <Button
                variant="link"
                className="visits-quiet-link"
                onClick={onChangeTime}
              >
                {text.changeTime}
              </Button>
              <Button
                variant="link"
                className="visits-quiet-link"
                onClick={onCallOff}
              >
                {text.callOff}
              </Button>
            </>
          )}
          {onPrintRequest && (
            <Button variant="link" className="visits-quiet-link" onClick={onPrintRequest}>
              {words.locale === "es" ? "Imprimir petición" : "Print request"}
            </Button>
          )}
        </div>
        <Button onClick={onPrint}>
          <Printer size={18} aria-hidden="true" /> {text.print}
        </Button>
      </div>
      <article
        className="visits-paper"
        aria-label={text.label(neighbor.name)}
      >
        <header>
          <p className="visits-paper-label">{sample ? text.kickerSample(sheet.group) : text.kicker(sheet.group)}</p>
          <h2>{neighbor.name}</h2>
          <p className="visits-paper-when">
            {capital(format(sheet.scheduledAt, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }))}
          </p>
        </header>
        <dl className="visits-paper-facts">
          <div>
            <dt>{text.address}</dt>
            <dd>{neighbor.address}</dd>
          </div>
          <div>
            <dt>{text.phone}</dt>
            <dd>{neighbor.phone || text.noPhone}</dd>
          </div>
          <div>
            <dt>{text.household}</dt>
            <dd>{household}</dd>
          </div>
          <div>
            <dt>{text.speaks}</dt>
            <dd>{spoken(room, neighbor)}</dd>
          </div>
          <div>
            <dt>{text.going}</dt>
            <dd className="visits-paper-pair">{sheet.status !== "scheduled" || sheet.visitors.length === 2
              ? together(room, sheet.visitors)
              : sheet.visitors.length
                ? text.secondToAsk(sheet.visitors[0])
                : text.twoToAsk}</dd>
          </div>
          {request && (
            <div>
              <dt>{text.askedFor}</dt>
              <dd>
                {request.payeeName
                  ? fill(text.owedTo, { need: need(words, request.kind, request.amount), payee: request.payeeName })
                  : need(words, request.kind, request.amount)}
              </dd>
            </div>
          )}
        </dl>
        {request?.summary && (
          <p className="visits-paper-words">
            <span>{text.theirWords}</span>
            {say(request.summary)}
          </p>
        )}
        {neighbor.notes && (
          <p className="visits-paper-words">
            <span>{text.goodToKnow}</span>
            {say(neighbor.notes)}
          </p>
        )}
        {sheet.lastVisit && (
          <p className="visits-paper-words">
            <span>
              {fill(text.lastVisit, { date: format(sheet.lastVisit.at), visitors: together(room, sheet.lastVisit.visitors) })}
            </span>
            <em className="visits-paper-last">{say(sheet.lastVisit.notes)}</em>
          </p>
        )}
        <section className="visits-paper-write">
          <h3>{text.prayerBefore}</h3>
          <div className="visits-lines">{lines(3)}</div>
        </section>
        <section className="visits-paper-write">
          <h3>{text.found}</h3>
          <div className="visits-lines">{lines(sheet.lastVisit ? 4 : 7)}</div>
        </section>
        <section className="visits-paper-write">
          <h3>{text.prayerAfter}</h3>
          <div className="visits-lines">{lines(3)}</div>
        </section>
        <dl className="visits-paper-blanks">
          <div>
            <dt>{text.hours}</dt>
            <dd />
          </div>
          <div>
            <dt>{text.miles}</dt>
            <dd />
          </div>
        </dl>
        <footer>
          <Lock size={15} aria-hidden="true" />
          {text.private}
        </footer>
        <p className="visits-paper-foot">
          <span>kind helps</span>
          <span>
            {sample ? text.printedSample(printed) : text.printed(printed)}
          </span>
        </p>
      </article>
    </>
  );
}
