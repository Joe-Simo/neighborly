"use client";

import "./people.css";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readFailure } from "@/components/workspace/failure";
import { LiveEmpty } from "@/components/workspace/primitives";
import { LiveFailure } from "@/components/workspace/states";
import type { LiveWorkspaceData } from "@/components/workspace/types";
import { useWorkspace } from "@/components/workspace/context";

/** "Ana Lucía Prieto" as "AP": the first and last name, so two people with one first name still differ. */
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : (parts[0]?.[1] ?? ""))).toUpperCase();
};
/** An address in two whole pieces: it may break before the at sign and nowhere else. A piece too long for the line is cut short, with the full address one press or hover away. */
function Address({ email }: { email: string }) {
  const at = email.lastIndexOf("@");
  return (
    <span className="people-address" title={email}>
      <span>{at < 0 ? email : email.slice(0, at)}</span>
      {at >= 0 && <span>{email.slice(at)}</span>}
    </span>
  );
}

/** The second step of removing someone for good: what goes, what stays, and their name typed before the button wakes. */
function RemoveForGood({ person, churchId, onClose }: { person: LiveWorkspaceData["people"][number]; churchId: LiveWorkspaceData["church"]["id"]; onClose: () => void }) {
  const remove = useMutation(api.people.remove);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const matches = typed.trim().toLowerCase() === person.name.trim().toLowerCase();
  return (
    <LiveDialog title={`Remove ${person.name} for good?`} description="This cannot be undone." onClose={onClose}>
      <form
        className="people-remove"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!matches || busy) return;
          setBusy(true);
          setFailed("");
          try {
            await remove({ churchId, personId: person.id, typedName: typed });
            onClose();
          } catch (cause) {
            setFailed(readFailure(cause, "They could not be removed just now."));
            setBusy(false);
          }
        }}
      >
        <dl>
          <dt>What goes</dt>
          <dd>Their name, their email address, their places on teams, their time off and their sign-in to this conference.</dd>
          <dt>What stays</dt>
          <dd>The visits, hours and decisions they logged. They stay in the year’s counts under “a former member”.</dd>
        </dl>
        <Label htmlFor="people-remove-name">Type {person.name} to confirm</Label>
        <Input id="people-remove-name" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="words" spellCheck={false} />
        {failed && <LiveFailure message={failed} kept="Nothing was removed." />}
        <Button type="submit" disabled={!matches || busy}>
          {busy ? "Removing" : "Remove for good"}
        </Button>
      </form>
    </LiveDialog>
  );
}

export function PeopleSection() {
  const { data, pending, isOwner, confirm: setConfirmation, words } = useWorkspace();
  const roles: Record<string, string> = words.people.roles;
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = data.people.find((person) => person.id === managingId);
  const [removing, setRemoving] = useState(false);
  return (
    <>
      {/* The rows are titled h3, so the list carries the h2 a screen reader steps by. */}
      <h2 className="sr-only">{words.menu.people}</h2>
      <div className="live-list">
        {data.people.map((person) => (
          <div className="live-row live-person-row people-row" key={person.id} data-away={person.active ? undefined : ""}>
            <div className="live-person">
              <span className="live-avatar" aria-hidden="true">
                {initials(person.name)}
              </span>
              <div>
                <h3>
                  {person.name}
                  <span className="people-role">{person.active ? (roles[person.role] ?? person.role) : words.people.removed}</span>
                </h3>
                {/* Members are sent names and roles only, so the line is there only for those who are sent an address. */}
                {person.email && <p><Address email={person.email} /></p>}
              </div>
            </div>
            <div className="live-meta">
              <span className="people-role-wide">{person.active ? (roles[person.role] ?? person.role) : words.people.removed}</span>
              {/* Approved is the rule, so only the exception is said. */}
              <span data-waits="">{!person.approved && words.people.waiting}</span>
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
        removing ? (
          <RemoveForGood person={managing} churchId={data.church.id} onClose={() => { setRemoving(false); setManagingId(null); }} />
        ) : (
        <LiveDialog title={managing.name} description={<><span className="people-address-full">{managing.email.slice(0, managing.email.lastIndexOf("@"))}<wbr />{managing.email.slice(managing.email.lastIndexOf("@"))}</span>{managing.active ? (roles[managing.role] ?? managing.role) : "Access removed"} · {managing.approved ? "Approved for service" : "Waiting for approval"}</>} onClose={() => setManagingId(null)}>
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
                  <small>{managing.approved ? "They can no longer be asked to cover. Accepted commitments stay." : "They can be asked to cover and to serve on teams."}</small>
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
                      body: "This changes access to your conference. Accepted commitments remain recorded; pending cover requests are withdrawn when access is removed.",
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
                  <small>{managing.active ? "They can no longer sign in to this conference. Their record stays." : "They can sign in to this conference again."}</small>
                </Button>
                <hr className="team-apart" />
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setRemoving(true)}>
                  Remove this person for good
                  <small>Their name, address and sign-in to this conference go. Visits and hours they logged stay in the year’s counts as “a former member”.</small>
                </Button>
          </div>
        </LiveDialog>
        )
      )}
      {isOwner && (
        <section className="live-section">
          <h2>Invitations</h2>
          <p className="live-deck people-deck">
            An invitation gives someone a way to join. It never accepts
            work on their behalf.
          </p>
          {data.invitations.length ? (
            <div className="people-invitations">
              {data.invitations.map((invite) => {
                const waits = invite.status === "pending";
                const joined = invite.status === "accepted";
                return (
                  <article
                    key={invite.id}
                    className={`people-invitation paper-corner paper-settle ${waits ? "paper-waits" : joined ? "paper-fold" : ""}`}
                  >
                    <h3><Address email={invite.email} /></h3>
                    <p>Invited as {(roles[invite.role] ?? invite.role).toLowerCase()}</p>
                    <div className="live-row-actions">
                      <span className="live-status" data-state={invite.status}>
                        {waits ? "Waiting for them to join" : joined ? "Joined" : invite.status}
                      </span>
                      {waits && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          aria-label={`Revoke the invitation to ${invite.email}`}
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
                  </article>
                );
              })}
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
