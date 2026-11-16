"use client";

import { useState } from "react";
import { usePaginatedQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField } from "@/components/workspace/primitives";
import { zoneName } from "@/components/workspace/zone";
import { useWorkspace } from "@/components/workspace/context";
import type {
  LiveCommand,
  LiveCommitment,
  LiveWorkspaceData,
} from "@/components/workspace/types";

export function CommitmentDetail({
  selected,
  error,
  onEdit,
  onRelease,
  onClose,
}: {
  selected: LiveCommitment | null;
  error: string;
  onEdit: (item: LiveCommitment) => void;
  onRelease: (item: LiveCommitment) => void;
  onClose: () => void;
}) {
  const { data, pending, perform, when, personName, teamName, confirm, words } =
    useWorkspace();
  return (
    <>
      <p className="live-kicker">{selected && teamName(selected.teamId)}</p>
      {selected && (
        <>
          {selected.status === "cancelled" && (
            <div className="live-note">
              {words.detail.cancelled}
            </div>
          )}
          {selected.status !== "cancelled" &&
            data.teams.find((team) => team.id === selected.teamId)
              ?.canCoordinate && (
              <div className="live-row-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(selected)}
                >
                  Edit details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    confirm({
                      title: "Cancel this commitment?",
                      body: "This cancels this date, releases its accepted person and withdraws pending cover requests. The record is kept in the history. Other dates and team memberships stay unchanged.",
                      command: {
                        type: "cancelCommitment",
                        commitmentId: selected.id,
                        expectedVersion: selected.version,
                      },
                    });
                    onClose();
                  }}
                >
                  Cancel commitment
                </Button>
              </div>
            )}
          <dl className="live-detail">
            <div>
              <dt>{words.detail.when}</dt>
              <dd>
                {when(selected.start, selected.end)}
                <br />
                <small>{zoneName(data.church.timeZone).replace(/^./, (first) => first.toUpperCase())}</small>
              </dd>
            </div>
            <div>
              <dt>{words.detail.where}</dt>
              <dd>{selected.location || words.detail.whereUnknown}</dd>
            </div>
            <div>
              <dt>{words.detail.person}</dt>
              <dd>{personName(selected.assigneeId)}</dd>
            </div>
            <div>
              <dt>{words.detail.coordinator}</dt>
              <dd>{selected.coordinatorName}</dd>
            </div>
          </dl>
          {selected.status !== "cancelled" &&
            selected.assigneeId === data.user.id && (
              <section>
                <h3>{words.detail.readyTitle}</h3>
                <p className="live-prep">
                  {selected.preparation ||
                    words.detail.noPreparation}
                </p>
                <Button
                  variant="outline"
                  onClick={() => onRelease(selected)}
                >
                  {words.detail.change}
                </Button>
              </section>
            )}
          {data.teams.find((team) => team.id === selected.teamId)
            ?.canCoordinate &&
            !selected.assigneeId &&
            selected.status !== "cancelled" && (
              <LiveCoverChooser
                data={data}
                commitment={selected}
                run={perform}
                pending={pending}
              />
            )}
          {error && (
            <div role="alert" className="live-error">
              {error}
            </div>
          )}
        </>
      )}
    </>
  );
}

function LiveCoverChooser({
  data,
  commitment,
  run,
  pending,
}: {
  data: LiveWorkspaceData;
  commitment: LiveWorkspaceData["commitments"][number];
  run: (command: LiveCommand, success?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const waiting = data.requests.filter(
    (request) =>
      request.commitmentId === commitment.id && request.status === "pending",
  );
  const candidates = usePaginatedQuery(
    api.pages.coverCandidates,
    waiting.length
      ? "skip"
      : { churchId: data.church.id, commitmentId: commitment.id },
    { initialNumItems: 10 },
  );
  const [recipient, setRecipient] = useState<Id<"memberships"> | "">("");
  return (
    <section>
      <h3>Ask someone to help</h3>
      <p>
        These people have opted in, confirmed availability and are approved for
        this team. Each person can accept or decline.
      </p>
      {waiting.map((request) => (
        <div className="live-note" key={request.id}>
          Awaiting a reply from{" "}
          {data.people.find((person) => person.id === request.recipientId)
            ?.name ?? "the invited member"}
          .{" "}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              void run(
                { type: "withdrawCover", requestId: request.id },
                "Request withdrawn.",
              )
            }
          >
            Withdraw request
          </Button>
        </div>
      ))}
      {!waiting.length && (
        <>
          <LiveField label="Person">
            <NativeSelect
              value={recipient}
              onChange={(event) =>
                setRecipient(
                  candidates.results.find(
                    (person) => person.id === event.target.value,
                  )?.id ?? "",
                )
              }
            >
              <option value="">Choose a person…</option>
              {candidates.results.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </LiveField>
          {candidates.status === "Exhausted" && !candidates.results.length && (
            <p>No eligible people are available for this date.</p>
          )}
          {candidates.status !== "Exhausted" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={candidates.status !== "CanLoadMore"}
              onClick={() => candidates.loadMore(10)}
            >
              {candidates.status === "CanLoadMore"
                ? "Load more eligible people"
                : "Checking availability…"}
            </Button>
          )}
          <Button
            style={{ marginTop: 16 }}
            disabled={pending || !recipient}
            onClick={async () => {
              if (!recipient) return;
              if (
                await run(
                  {
                    type: "requestCover",
                    commitmentId: commitment.id,
                    expectedVersion: commitment.version,
                    recipientId: recipient,
                  },
                  "Cover request saved. It is awaiting their reply.",
                )
              )
                setRecipient("");
            }}
          >
            Ask for cover
          </Button>
        </>
      )}
    </section>
  );
}
