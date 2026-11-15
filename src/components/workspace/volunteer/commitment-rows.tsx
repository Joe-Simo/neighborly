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
  empty,
}: {
  items: LiveWorkspaceData["commitments"];
  empty?: { title: string; detail: string };
}) {
  const { data, format, when, personName, teamName, showCommitment, words } =
    useWorkspace();
  const statuses: Partial<Record<string, string>> = words.commitments.status;
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
                size="sm"
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

export function IncomingRequests() {
  const {
    data,
    requestCommitments,
    pending,
    perform,
    when,
    showCommitment,
    focusOutcome,
    words,
  } = useWorkspace();
  const incoming = incomingRequests(data);
  return incoming.length ? (
      <section className="live-section live-request-section paper-settle" aria-labelledby="live-requests-title">
        <div className="live-section-head">
          <h2 id="live-requests-title">{words.requests.title}</h2>
          <span className="live-count">
            {words.requests.awaiting(incoming.length)}
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
                  <h3>{item?.title ?? words.requests.fallbackTitle}</h3>
                  <p>
                    {item
                      ? when(item.start, item.end)
                      : words.requests.unavailable}
                  </p>
                  {item?.location && <p className="live-request-location">{item.location}</p>}
                </div>
                <div className="live-row-actions">
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
                        words.requests.accepted,
                      );
                      if (saved) focusOutcome();
                    }}
                  >
                    {words.requests.accept}
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
                        words.requests.declined,
                      );
                      if (saved) focusOutcome();
                    }}
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
              </div>
            );
          })}
        </div>
      </section>
    ) : null;
}
