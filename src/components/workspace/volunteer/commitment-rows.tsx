"use client";

import { FOLD_HOLD, foldLeaves, useSeenForSix } from "@/components/workspace/fold";
import "./volunteer.css";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
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
  const { data, format, when, personName, teamName, showCommitment, words } =
    useWorkspace();
  const statuses: Partial<Record<string, string>> = words.commitments.status;
  const landed = useRef<string>(undefined);
  const land = (row: HTMLDivElement | null) => {
    if (!row || landed.current === fresh) return;
    landed.current = fresh;
    // The page stays where it is unless the row is wholly out of view.
    const { top, bottom } = row.getBoundingClientRect();
    if (bottom > 0 && top < window.innerHeight) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  };
  return items.length ? (
      <div className="live-list">
        {items.map((item) => (
          <div
            className={`live-row live-commitment-row${item.id === fresh ? " volunteer-filed" : ""}`}
            // Show where the accepted commitment landed, if it is off the screen.
            ref={item.id === fresh ? land : undefined}
            key={item.id}
          >
            <div className="live-date-leaf" aria-hidden="true"><span>{format(item.start, { day: undefined, month: "short" })}</span><strong>{format(item.start, { month: undefined, day: "numeric" })}</strong><span>{format(item.start, { month: undefined, day: undefined, weekday: "short" })}</span></div>
            <div className="live-row-main">
              <div className="live-meta">
                <span>{teamName(item.teamId)}</span>
                <span className="live-commitment-time">{when(item.start, item.end)}</span>
              </div>
              <h3>{item.title}</h3>
              <p>
                {item.assigneeId
                  ? personName(item.assigneeId)
                  : words.commitments.placeOpen}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <div className="live-row-actions">
              <span className="live-status" data-state={item.status}>
                {statuses[item.status] ?? item.status.replaceAll("_", " ")}
              </span>
              <Button
                variant="outline"
                onClick={(event) => showCommitment(item, event.currentTarget)}
              >
                {item.assigneeId === data.user.id && item.status === "accepted"
                  ? item.preparation.trim() ? words.commitments.viewPreparation : words.commitments.viewCommitment
                  : words.commitments.details} <ArrowRight size={15} aria-hidden="true" />
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
  const seen = useSeenForSix(line);
  // Focus tells a screen reader; it must not pull the page away from where the sheet was.
  useEffect(() => line.current?.focus({ preventScroll: true }), []);
  return (
    <p
      ref={line}
      tabIndex={-1}
      role="status"
      className={seen ? "live-success volunteer-said paper-settle" : "sr-only"}
    >
      {children}
    </p>
  );
}

type CoverRequest = LiveWorkspaceData["requests"][number];

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
 * The sheet of what waits for this person's yes. Its corner is ochre while it waits.
 * On Accept the corner folds green and the line reads accepted for a beat; then the
 * sheet leaves and `onAccepted` names the commitment, so the list below can lay it in.
 */
export function IncomingRequests({
  onGiven,
  onAccepted,
}: {
  /** The commitment whose yes was just pressed, while its sheet is held; undefined once the hold is over. */
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
  } = useWorkspace();
  const [given, setGiven] = useState<CoverRequest>();
  const [said, setSaid] = useState<{ words: string; of: string }>();
  const incoming = incomingRequests(data);
  // The request just accepted leaves the data at once; the sheet keeps it for the beat.
  const shown =
    given && !incoming.some((request) => request.id === given.id)
      ? [given, ...incoming]
      : incoming;
  const statuses: Partial<Record<string, string>> = words.commitments.status;
  const respond = async (request: CoverRequest, accept: boolean) => {
    if (accept) {
      setGiven(request);
      onGiven?.(request.commitmentId);
    }
    const beat = new Promise((settle) => setTimeout(settle, accept ? FOLD_HOLD : 0));
    setSaid(undefined);
    const saved = await perform({ type: "respondCover", requestId: request.id, accept });
    if (accept && saved) {
      await beat;
      await foldLeaves();
    }
    setGiven(undefined);
    onGiven?.(undefined);
    if (!saved) return;
    if (accept) onAccepted?.(request.commitmentId);
    setSaid({ words: accept ? words.requests.accepted : words.requests.declined, of: request.id });
  };
  const line = said && <Said key={said.of}>{said.words}</Said>;
  const waiting = shown.filter((request) => request.id !== given?.id).length;
  return shown.length ? (
    <>
      {line}
      <section
        className={`help-sheet volunteer-choice${given ? " paper-fold" : ""}`}
        // The last request takes the sheet with it; otherwise only its own line leaves.
        data-fold-leaves={given && shown.length === 1 ? "" : undefined}
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
              <div className="volunteer-choice-row" data-fold-leaves={request.id === given?.id && shown.length > 1 ? "" : undefined} key={request.id}>
                <div>
                  <h3>{item?.title ?? words.requests.fallbackTitle}</h3>
                  <p className="volunteer-choice-when">
                    {item
                      ? when(item.start, item.end)
                      : words.requests.unavailable}
                  </p>
                  {item?.location && <p>{item.location}</p>}
                </div>
                {request.id === given?.id ? (
                  <p className="volunteer-given" role="status">
                    <CircleCheck size={22} aria-hidden="true" />
                    {statuses.accepted}
                  </p>
                ) : (
                  <div className="live-row-actions">
                    <Button
                      disabled={pending || !item}
                      onClick={() => void respond(request, true)}
                    >
                      {words.requests.accept}
                    </Button>
                    <Button
                      disabled={pending}
                      variant="outline"
                      onClick={() => void respond(request, false)}
                    >
                      {words.requests.decline}
                    </Button>
                    {item && (
                      <Button
                        variant="link"
                        className="tools-quiet"
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
    ) : (line ?? null);
}
