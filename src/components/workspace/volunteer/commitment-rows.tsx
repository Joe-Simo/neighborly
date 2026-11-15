"use client";

import { ArrowRight } from "lucide-react";
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
  empty = {
    title: "No upcoming commitments.",
    detail: "New commitments will appear here with their date, person and preparation.",
  },
}: {
  items: LiveWorkspaceData["commitments"];
  empty?: { title: string; detail: string };
}) {
  const { data, format, when, personName, teamName, showCommitment } =
    useWorkspace();
  return items.length ? (
      <div className="live-list">
        {items.map((item) => (
          <div className="live-row live-commitment-row" key={item.id}>
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
                  : "A place is open"}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <div className="live-row-actions">
              <span className="live-status" data-state={item.status}>
                {item.status.replaceAll("_", " ")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => showCommitment(item, event.currentTarget)}
              >
                {item.assigneeId === data.user.id && item.status === "accepted"
                  ? item.preparation.trim() ? "View preparation" : "View commitment"
                  : "Details"} <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <LiveEmpty title={empty.title}>{empty.detail}</LiveEmpty>
    );
}

export function IncomingRequests() {
  const {
    data,
    requestCommitments,
    pending,
    perform,
    when,
    showCommitment,
    focusOutcome,
  } = useWorkspace();
  const incoming = incomingRequests(data);
  return incoming.length ? (
      <section className="live-section live-request-section" aria-labelledby="live-requests-title">
        <div className="live-section-head">
          <h2 id="live-requests-title">Your choice</h2>
          <span className="live-count">
            {incoming.length} awaiting your reply
          </span>
        </div>
        <div className="live-list">
          {incoming.map((request) => {
            const item = requestCommitments.find(
              (commitment) => commitment.id === request.commitmentId,
            ) ?? data.commitments.find(
              (commitment) => commitment.id === request.commitmentId,
            );
            return (
              <div className="live-row" key={request.id}>
                <div>
                  <h3>{item?.title ?? "Cover request"}</h3>
                  <p>
                    {item
                      ? when(item.start, item.end)
                      : "Commitment details unavailable"}
                  </p>
                  {item?.location && <p className="live-request-location">{item.location}</p>}
                </div>
                <div className="live-row-actions">
                  {item && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => showCommitment(item, event.currentTarget)}
                    >
                      Details
                    </Button>
                  )}
                  <Button
                    disabled={pending || !item}
                    size="sm"
                    onClick={async () => {
                      const saved = await perform(
                        {
                          type: "respondCover",
                          requestId: request.id,
                          accept: true,
                        },
                        "Commitment accepted. Your plan is updated.",
                      );
                      if (saved) focusOutcome();
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={pending}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const saved = await perform(
                        {
                          type: "respondCover",
                          requestId: request.id,
                          accept: false,
                        },
                        "Request declined. No commitment has been assigned.",
                      );
                      if (saved) focusOutcome();
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ) : null;
}
