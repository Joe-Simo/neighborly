"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { count, spokenLabel } from "@/components/workspace/help-line/format";
import { readFailure } from "@/components/workspace/failure";
import { HelpLoading } from "@/components/workspace/help-line/room";
import { LiveFailure } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import { TimeForm } from "@/components/workspace/visits/forms";
import { need, useEnglishDates, type Sheet } from "@/components/workspace/visits/format";

/**
 * What the pair carries to the door, made to be printed.
 * Opening it shows a neighbor's details, so it is written down first, like opening the record.
 */
export function VisitSheet({ visitId }: { visitId: Id<"visits"> }) {
  const { data, now, setHeading, words } = useWorkspace();
  const format = useEnglishDates();
  const churchId = data.church.id;
  // One neighbor's details: a plain head, with no painting.
  useLayoutEffect(() => {
    setHeading({
      title: "For the two at the door.",
      deck: "The visit sheet, to print and carry. It has room to write and to pray.",
    });
    return () => setHeading(null);
  }, [setHeading]);
  const router = useRouter();
  const openSheet = useMutation(api.visits.openSheet);
  const cancel = useMutation(api.visits.cancel);
  const [opened, setOpened] = useState(false);
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
      () => {
        if (!current) return;
        setRefused(null);
        setOpened(true);
      },
      // Without this the quiet "Opening…" line would stay for ever, saying something is on its way when nothing is.
      (cause: unknown) => {
        if (current) setRefused({ sentence: readFailure(cause, "The visit sheet didn’t open."), attempt });
      },
    );
    return () => {
      current = false;
    };
  }, [openSheet, churchId, visitId, attempt]);
  const sheet = useQuery(
    api.visits.sheet,
    opened ? { churchId, visitId } : "skip",
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
              <ArrowLeft size={17} aria-hidden="true" /> Home visits
            </Link>
          </div>
        </div>
        <DidNotOpen
          key={refused.attempt}
          sentence={refused.sentence}
          trying={refused.attempt !== attempt}
          tryAgain={words.states.tryAgain}
        />
      </form>
    );
  if (!sheet) return <HelpLoading label="Opening the visit sheet" />;
  return (
    <>
      <VisitSheetView
        sheet={sheet}
        format={format}
        printed={format(now, { month: "long", day: "numeric", year: "numeric" })}
        sample={data.church.sample}
        onPrint={() => window.print()}
        onCallOff={() => setStep("callOff")}
        onChangeTime={() => setStep("time")}
      />
      {step === "time" && (
        <LiveDialog
          title="Change the time"
          description={sheet.visitors.length ? `${sheet.visitors.join(" and ")} will be asked again, since the yes was for the old time.` : "Choose the new time."}
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
          title="Call off this visit?"
          description={`${sheet.neighbor.name} goes back to waiting for a pair.`}
          onClose={() => setConfirming(false)}
        >
          <p className="visits-consequence">
            {sheet.visitors.length
              ? `${sheet.visitors.join(" and ")} will see the visit gone from My commitments. No message is sent, so please tell ${sheet.visitors.map((name) => name.split(/\s+/)[0]).join(" and ")} yourself.`
              : "No visitor is on this visit now, so no one needs to be told."}
          </p>
          {error && <LiveFailure message={error} kept="" />}
          <div className="live-form-actions">
            <Button
              disabled={pending}
              onClick={async () => {
                const outcome = await save(() => cancel({ churchId, visitId }));
                if (outcome.saved) router.push("/app/visits");
              }}
            >
              Call off the visit
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
function DidNotOpen({ sentence, trying, tryAgain }: { sentence: string; trying: boolean; tryAgain: string }) {
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
          <p className="live-error-recovery">Nothing was changed. Try again, or go back to Home visits.</p>
        </div>
        <Button type="submit" variant="outline" className="aria-disabled:opacity-50" aria-disabled={trying || undefined}>
          {tryAgain}
        </Button>
      </div>
      {trying && (
        <p className="live-waiting" role="status" style={{ marginTop: 12 }}>
          Opening the visit sheet…
        </p>
      )}
    </>
  );
}

const lines = (n: number) =>
  Array.from({ length: n }, (_, index) => <i key={index} />);

export function VisitSheetView({
  sheet,
  format,
  printed,
  sample,
  onPrint,
  onCallOff,
  onChangeTime,
}: {
  sheet: Sheet;
  format: Workspace["format"];
  onPrint: () => void;
  /** Today's date, for the foot of the printed page. */
  printed: string;
  /** The sample conference's sheets say so on paper, so a made-up household is never taken for a real one. */
  sample?: boolean;
  onCallOff: () => void;
  onChangeTime: () => void;
}) {
  const { neighbor, request } = sheet;
  const household = [
    count(neighbor.adults, "adult", "adults"),
    neighbor.children ? count(neighbor.children, "child", "children") : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <div className="visits-sheet-bar">
        <div className="visits-sheet-links">
          <Link className="visits-back" href="/app/visits">
            <ArrowLeft size={17} aria-hidden="true" /> Home visits
          </Link>
          {sheet.status === "scheduled" && (
            <>
              <Button
                variant="link"
                className="visits-quiet-link"
                onClick={onChangeTime}
              >
                Change the time
              </Button>
              <Button
                variant="link"
                className="visits-quiet-link"
                onClick={onCallOff}
              >
                Call off the visit
              </Button>
            </>
          )}
        </div>
        <Button onClick={onPrint}>
          <Printer size={18} aria-hidden="true" /> Print this sheet
        </Button>
      </div>
      <article
        className="visits-paper"
        aria-label={`Visit sheet for ${neighbor.name}`}
      >
        <header>
          <p className="visits-paper-label">Home visit · {sheet.group}{sample ? " · Sample" : ""}</p>
          <h2>{neighbor.name}</h2>
          <p className="visits-paper-when">
            {format(sheet.scheduledAt, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </header>
        <dl className="visits-paper-facts">
          <div>
            <dt>Address</dt>
            <dd>{neighbor.address}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{neighbor.phone || "None on file"}</dd>
          </div>
          <div>
            <dt>Household</dt>
            <dd>{household}</dd>
          </div>
          <div>
            <dt>Speaks</dt>
            <dd>{spokenLabel(neighbor)}</dd>
          </div>
          <div>
            <dt>Going together</dt>
            <dd className="visits-paper-pair">{sheet.status !== "scheduled" || sheet.visitors.length === 2
              ? sheet.visitors.join(" and ")
              : sheet.visitors.length
                ? `${sheet.visitors[0]}, and a second visitor still to be asked`
                : "Two visitors still to be asked"}</dd>
          </div>
          {request && (
            <div>
              <dt>Asked for</dt>
              <dd>
                {need(request.kind, request.amount)}
                {request.payeeName ? `, owed to ${request.payeeName}` : ""}
              </dd>
            </div>
          )}
        </dl>
        {request?.summary && (
          <p className="visits-paper-words">
            <span>In their words</span>
            {request.summary}
          </p>
        )}
        {neighbor.notes && (
          <p className="visits-paper-words">
            <span>Good to know</span>
            {neighbor.notes}
          </p>
        )}
        {sheet.lastVisit && (
          <p className="visits-paper-words">
            <span>
              Last visit, {format(sheet.lastVisit.at)}, by{" "}
              {sheet.lastVisit.visitors.join(" and ")}
            </span>
            <em className="visits-paper-last">{sheet.lastVisit.notes}</em>
          </p>
        )}
        <section className="visits-paper-write">
          <h3>Prayer before the visit</h3>
          <div className="visits-lines">{lines(3)}</div>
        </section>
        <section className="visits-paper-write">
          <h3>What we found</h3>
          <div className="visits-lines">{lines(sheet.lastVisit ? 4 : 7)}</div>
        </section>
        <section className="visits-paper-write">
          <h3>Prayer after the visit</h3>
          <div className="visits-lines">{lines(3)}</div>
        </section>
        <dl className="visits-paper-blanks">
          <div>
            <dt>Hours</dt>
            <dd />
          </div>
          <div>
            <dt>Miles</dt>
            <dd />
          </div>
        </dl>
        <footer>
          <Lock size={15} aria-hidden="true" />
          Private. After the write-up, hand this sheet back or shred it.
        </footer>
        <p className="visits-paper-foot">
          <span>kind helps</span>
          <span>
            {sample ? "Sample · " : ""}Printed {printed}
          </span>
        </p>
      </article>
    </>
  );
}
