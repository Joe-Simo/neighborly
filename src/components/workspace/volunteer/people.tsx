"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";

export function PeopleSection() {
  const { data, pending, isOwner, confirm: setConfirmation } = useWorkspace();
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = data.people.find((person) => person.id === managingId);
  return (
    <>
      <div className="live-list">
        {data.people.map((person) => (
          <div className="live-row live-person-row" key={person.id}>
            <div className="live-person">
              <span className="live-avatar">
                {person.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{person.name}</h3>
                <p>{person.email}</p>
              </div>
            </div>
            <div className="live-meta">
              <span>
                {person.active ? person.role : "Access removed"}
              </span>
              <span>
                {person.approved
                  ? "Approved for service"
                  : "Approval pending"}
              </span>
            </div>
            <div className="live-row-actions">
              {isOwner && person.role !== "owner" && (
                <Button variant="outline" size="sm" aria-label={`Manage ${person.name}`} onClick={() => setManagingId(person.id)}>
                  Manage
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {managing && (
        <LiveDialog title={managing.name} description={<>{managing.active ? managing.role : "Access removed"} · {managing.approved ? "Approved for service" : "Approval pending"}</>} onClose={() => setManagingId(null)}>
          <div className="live-manage">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    {
                    setManagingId(null);
                    setConfirmation({
                      title: managing.approved
                        ? "Revoke service approval?"
                        : "Approve for service?",
                      body: "Team qualifications are managed separately. Revoking approval withdraws pending cover requests; accepted commitments stay intact.",
                      command: {
                        type: "setApproval",
                        personId: managing.id,
                        approved: !managing.approved,
                      },
                    });
                  }}
                >
                  {managing.approved ? "Revoke approval" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    {
                    setManagingId(null);
                    setConfirmation({
                      title: managing.active
                        ? "Remove workspace access?"
                        : "Restore workspace access?",
                      body: "This changes access to your group workspace. Accepted commitments remain recorded; pending cover requests are withdrawn when access is removed.",
                      command: {
                        type: "setMembership",
                        personId: managing.id,
                        active: !managing.active,
                        role:
                          managing.role === "coordinator"
                            ? "coordinator"
                            : "member",
                      },
                    });
                  }}
                >
                  {managing.active ? "Remove access" : "Restore access"}
                </Button>
          </div>
        </LiveDialog>
      )}
      {isOwner && (
        <section className="live-section">
          <h2>Invitations</h2>
          <p className="live-deck">
            An invitation gives someone a way to join. It never accepts
            work on their behalf.
          </p>
          {data.invitations.length ? (
            <div className="live-list">
              {data.invitations.map((invite) => (
                <div className="live-row" key={invite.id}>
                  <div>
                    <h3>{invite.email}</h3>
                    <p>{invite.role}</p>
                  </div>
                  <div className="live-row-actions">
                    <span className="live-status" data-state="pending">
                      {invite.status}
                    </span>
                    {invite.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setConfirmation({
                            title: "Revoke this invitation?",
                            body: "The link will stop working. This does not remove anyone who has already joined.",
                            command: {
                              type: "revokeInvitation",
                              invitationId: invite.id,
                            },
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <LiveEmpty title="No open invitations.">
              Invite people when you’re ready to bring them into this
              workspace.
            </LiveEmpty>
          )}
        </section>
      )}
    </>
  );
}
