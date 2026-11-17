"use client";

import { SavedWords } from "@/components/workspace/saved-words";
import { FOLD_HOLD, arriving, foldLeaves, openUp, useSavedLine, viewTop } from "@/components/workspace/fold";
import "./volunteer.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useConnectionLost } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/context";
import type { LiveWorkspaceData } from "@/components/workspace/types";

export function incomingRequests(data: LiveWorkspaceData) {
  return data.requests.filter(
    (request) =>
      request.recipientId === data.user.id && request.status === "pending",
  );
}

export function CommitmentRows({
  items,
  empty,
  fresh,
}: {
  items: LiveWorkspaceData["commitments"];
  empty?: { title: string; detail: string };
  /** The commitment just accepted: its row is laid in. */
  fresh?: string;
}) {
  const { data, format, when, personName, teamName, showCommitment, words, sampleSaid } =
    useWorkspace();
  const statuses: Partial<Record<string, string>> = words.commitments.status;
  // The accepted row opens its own room in the list, once, before it is painted.
  const opened = useRef<string>(undefined);
  const arrive = (row: HTMLDivElement | null) => {
    if (!row || opened.current === fresh) return;
    opened.current = fresh;
    openUp(row);
  };
  const opens = (item: (typeof items)[number]) =>
    item.assigneeId === data.user.id && item.status === "accepted"
      ? item.preparation.trim() ? words.commitments.viewPreparation : words.commitments.viewCommitment
      : words.commitments.details;
  return items.length ? (
      <div className="live-list">
        {items.map((item) => (
          <div
            className={`live-row live-commitment-row${item.id === fresh ? " volunteer-filed" : ""}`}
            ref={item.id === fresh ? arrive : undefined}
            key={item.id}
          >
            <div className="live-date-leaf" aria-hidden="true"><span>{format(item.start, { day: undefined, month: "short" })}</span><strong>{format(item.start, { month: undefined, day: "numeric" })}</strong><span>{format(item.start, { month: undefined, day: undefined, weekday: "short" })}</span></div>
            <div className="live-row-main">
              <div className="live-meta">
                <span>{teamName(item.teamId)}</span>
                <span className="live-commitment-time">{when(item.start, item.end)}</span>
              </div>
              <h3>{sampleSaid(item.title)}</h3>
              <p>
                {item.assigneeId
                  ? personName(item.assigneeId)
                  : words.commitments.placeOpen}
                {item.location ? ` · ${sampleSaid(item.location)}` : ""}
              </p>
            </div>
            <div className="live-row-actions">
              <span className="live-status" data-state={item.status}>
                {statuses[item.status] ?? item.status.replaceAll("_", " ")}
              </span>
              <Button
                variant="outline"
                className="live-row-opens"
                aria-label={`${opens(item)}: ${sampleSaid(item.title)}, ${when(item.start, item.end)}`}
                data-opens=""
                onClick={(event) => showCommitment(item, event.currentTarget)}
              >
                {opens(item)} <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <LiveEmpty title={empty?.title ?? words.commitments.emptyTitle}>{empty?.detail ?? words.commitments.emptyDetail}</LiveEmpty>
    );
}

/**
 * The line that says a reply was taken. It is seen for six seconds, then leaves the
 * page and stays as a message for screen readers.
 */
function Said({ children }: { children: string }) {
  const line = useRef<HTMLParagraphElement>(null);
  const seen = useSavedLine(line);
  // Focus tells a screen reader; it must not pull the page away from where the sheet was.
  useEffect(() => line.current?.focus({ preventScroll: true }), []);
  return (
    <p
      ref={line}
      tabIndex={-1}
      role="status"
      className={seen ? "live-success help-done volunteer-said paper-settle" : "sr-only"}
    >
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {seen ? <SavedWords>{children}</SavedWords> : children}
    </p>
  );
}

type CoverRequest = LiveWorkspaceData["requests"][number];

/**
 * The one quiet line under a request whose answer cannot leave yet, the connection being down. It says the
 * answer is kept (nothing was typed here, so the family's line about typing would be wrong). Other requests lie
 * under it, so its room is opened as it is laid and closed as it leaves: nothing under it jumps. Empty, it takes
 * no room at all.
 */
function WaitsToGo({ when }: { when: boolean }) {
  const { words } = useWorkspace();
  // Only once the connection has been down two seconds, as everywhere: a blink shows nothing.
  const lost = useConnectionLost();
  const shown = when && lost;
  const box = useRef<HTMLDivElement>(null);
  const tall = useRef(0);
  // Before the browser paints, so the line is never drawn at full height first.
  useLayoutEffect(() => {
    const line = box.current?.firstElementChild;
    if (line instanceof HTMLElement) {
      tall.current = line.offsetHeight;
      // The line stays for as long as the connection is down, so it is never held fixed over the rows: laid above
      // the window it goes straight into the page, and the window keeps what the person is looking at.
      openUp(line, { stays: true });
    } else if (tall.current && box.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // The line is already out of the page, so there is nothing to hand to closeUp: its place gives up the room
      // the line really took, in the same 360ms.
      box.current.animate([{ height: `${tall.current}px` }, { height: "0px" }], { duration: 360, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
      tall.current = 0;
    } else {
      tall.current = 0;
    }
  }, [shown]);
  return (
    <div className="volunteer-choice-waits" ref={box}>
      {shown && (
        <p className="live-waiting" role="status">
          {words.states.answerKept}
        </p>
      )}
    </div>
  );
}

/**
 * The word that takes the buttons' place takes the focus they had, once, and only when focus has fallen to the
 * page with them: a person who has moved on to something else keeps their place.
 */
const takeFocus = (word: HTMLElement | null) => {
  if (word && document.activeElement === document.body) word.focus({ preventScroll: true });
};

/**
 * Focus goes back to the button that was pressed when its answer was refused. The button is still asleep
 * (disabled) at that moment, so this waits for it; focus is never left to fall to the page. The wait can be
 * long (a whole outage), so the same rule as takeFocus holds at the end of it: a person who has moved on to
 * something else keeps their place.
 */
function focusOnceAwake(button: HTMLButtonElement, tries = 90) {
  if (!button.isConnected) return;
  requestAnimationFrame(() => {
    if (button.disabled && tries > 0) return focusOnceAwake(button, tries - 1);
    const now = document.activeElement;
    if (now === button || now === document.body) button.focus({ preventScroll: true });
  });
}

/** The green line with its margin, and the row's own travel: what pushes the row down after it is measured. */
const LINE_ROOM = 120;

/**
 * For a room with the sheet above a list: the commitment stays out of the list while its sheet is held,
 * then travels into the list as the sheet closes. Spread `requests` on IncomingRequests, drop `held`
 * from the list's items and give the list `fresh`.
 */
export function useAcceptedArrival() {
  const [held, setHeld] = useState<string>();
  const [fresh, setFresh] = useState<string>();
  return { held, fresh, requests: { onGiven: setHeld, onAccepted: setFresh } };
}

/**
 * The sheet of what waits for this person's yes. Its corner is ochre while it waits, and it
 * stays ochre, its buttons in place, while the yes is on its way. Only once the yes is saved does
 * the corner fold green and the line read accepted for a beat; then the sheet leaves and
 * `onAccepted` names the commitment, so the list below can lay it in.
 */
export function IncomingRequests({
  onGiven,
  onAccepted,
  place,
}: {
  /** The heading of the list the accepted commitment goes into, said in the green line when that row is out of view. */
  place?: string;
  /** The commitment whose yes was just pressed, while it is on its way and while its sheet is held; undefined once the hold is over or the yes was refused. */
  onGiven?: (commitmentId: string | undefined) => void;
  onAccepted?: (commitmentId: string) => void;
}) {
  const {
    data,
    requestCommitments,
    pending,
    perform,
    when,
    showCommitment,
    words,
    sampleSaid,
  } = useWorkspace();
  // `given` is the request whose yes was pressed: it is kept on the sheet from the press to the end of the beat.
  // It is not green for that. Green is `taken`: the same request, once its save has truly gone through.
  const [given, setGiven] = useState<CoverRequest>();
  const [saved, setSaved] = useState<string>();
  const taken = given && saved === given.id ? given : undefined;
  // The request whose answer, yes or no, is on its way: its row is the one that says so when the connection is lost.
  const [sent, setSent] = useState<string>();
  const [said, setSaid] = useState<{ words: string; of: string }>();
  const incoming = incomingRequests(data);
  // The request just accepted leaves the data the moment it is saved; the sheet keeps it for the beat.
  const shown =
    given && !incoming.some((request) => request.id === given.id)
      ? [given, ...incoming]
      : incoming;
  const statuses: Partial<Record<string, string>> = words.commitments.status;
  const respond = async (request: CoverRequest, accept: boolean, pressed: HTMLButtonElement) => {
    // Nothing here is green yet. The request and its commitment are only held where they are, so that when the
    // save lands (the data changes a moment before `perform` answers) the row does not leave the sheet or show up
    // in the list below ahead of the beat. Offline the save is only queued and `perform` does not answer: the
    // buttons stay, asleep, and the row says it is waiting.
    if (accept) {
      setGiven(request);
      onGiven?.(request.commitmentId);
    }
    setSent(request.id);
    setSaid(undefined);
    const done = await perform({ type: "respondCover", requestId: request.id, accept });
    setSent(undefined);
    if (!done) {
      setGiven(undefined);
      onGiven?.(undefined);
      // The buttons never left; the one that was pressed has focus again once it wakes.
      focusOnceAwake(pressed);
      return;
    }
    if (!accept) return setSaid({ words: words.requests.declined, of: request.id });
    // Saved: now the corner folds green and the word reads accepted, and the beat starts from this moment.
    setSaved(request.id);
    await new Promise((settle) => setTimeout(settle, FOLD_HOLD));
    // The page never moves after a yes. The row enters its list while the sheet is still there; where it
    // will rest once the sheet has closed and the green line is laid is worked out from that, and when
    // that is not wholly inside the window the line says where it is.
    const leaving = document.querySelector<HTMLElement>("[data-fold-leaves]")?.offsetHeight ?? 0;
    arriving(() =>
      flushSync(() => {
        onGiven?.(undefined);
        onAccepted?.(request.commitmentId);
      }),
    );
    // (The row is still closed at this moment, opening its room, so its full height is read from what it holds.)
    const row = document.querySelector(".live-row.volunteer-filed");
    const top = row ? row.getBoundingClientRect().top - leaving + LINE_ROOM : 0;
    const hidden = row && (top < viewTop() || top + row.scrollHeight > window.innerHeight);
    // The line opens as the sheet closes, in one move. It is laid first, so the close knows it is there. The sheet is
    // taken out the moment its close ends, before anything is drawn; for less motion the close is a plain cut, so
    // the line and the cut are one change and the line is never drawn over the whole sheet.
    flushSync(() => setSaid({ words: hidden && place ? words.requests.acceptedUnder(place) : words.requests.accepted, of: request.id }));
    await foldLeaves();
    flushSync(() => setGiven(undefined));
  };
  const line = said && <Said key={said.of}>{said.words}</Said>;
  const waiting = shown.filter((request) => request.id !== taken?.id).length;
  return shown.length ? (
    <>
      {line}
      <section
        className={`help-sheet volunteer-choice${taken ? " paper-fold" : ""}`}
        // The last request takes the sheet with it; otherwise only its own line leaves.
        data-fold-leaves={taken && shown.length === 1 ? "" : undefined}
        aria-labelledby="live-requests-title">
        <p className="help-sheet-label">{waiting ? words.requests.awaiting(waiting) : statuses.accepted}</p>
        <h2 id="live-requests-title">{words.requests.title}</h2>
        <div className="volunteer-choice-rows">
          {shown.map((request) => {
            const item = requestCommitments.find(
              (commitment) => commitment.id === request.commitmentId,
            ) ?? data.commitments.find(
              (commitment) => commitment.id === request.commitmentId,
            );
            return (
              <div className="volunteer-choice-row" data-fold-leaves={request.id === taken?.id && shown.length > 1 ? "" : undefined} key={request.id}>
                <div>
                  <h3>{item ? sampleSaid(item.title) : words.requests.fallbackTitle}</h3>
                  <p className="volunteer-choice-when">
                    {item
                      ? when(item.start, item.end)
                      : words.requests.unavailable}
                  </p>
                  {item?.location && <p>{sampleSaid(item.location)}</p>}
                  <WaitsToGo when={pending && request.id === sent} />
                </div>
                {request.id === taken?.id ? (
                  // The buttons it replaces are gone, so the word takes focus: it is never left to fall to the page.
                  <p className="volunteer-given" role="status" tabIndex={-1} ref={takeFocus}>
                    <CircleCheck size={22} aria-hidden="true" />
                    {statuses.accepted}
                  </p>
                ) : (
                  <div className="live-row-actions">
                    <Button
                      disabled={pending || !item}
                      aria-label={`${words.requests.accept}: ${item ? sampleSaid(item.title) : words.requests.fallbackTitle}`}
                      onClick={(event) => void respond(request, true, event.currentTarget)}
                    >
                      {words.requests.accept}
                    </Button>
                    <Button
                      disabled={pending}
                      variant="outline"
                      aria-label={`${words.requests.decline}: ${item ? sampleSaid(item.title) : words.requests.fallbackTitle}`}
                      onClick={(event) => void respond(request, false, event.currentTarget)}
                    >
                      {words.requests.decline}
                    </Button>
                    {item && (
                      <Button
                        variant="link"
                        className="tools-quiet"
                        aria-label={`${words.commitments.details}: ${sampleSaid(item.title)}`}
                        data-opens=""
                onClick={(event) => showCommitment(item, event.currentTarget)}
                      >
                        {words.commitments.details}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
    ) : (
    // The same shape as above, so the line is the same line when the sheet has gone.
    <>{line}</>
  );
}
