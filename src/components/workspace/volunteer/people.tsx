"use client";

import "./people.css";
import "@/components/workspace/for-good.css";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Lock } from "lucide-react";
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
import { words as wordsFor } from "@/lib/words";

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
    <LiveDialog title="Remove this person" description={`Everything we keep about ${person.name} in this conference, for good.`} onClose={onClose}>
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
        <dl className="for-good-terms">
          <div>
          <dt>What goes</dt>
          <dd>Their name and email address, their places on teams, their time off, and their sign-in to this conference. What they had promised to do from now on is open again. Planned visits they were part of will need a new second visitor.</dd>
          </div>
          <div>
          <dt>What stays</dt>
          <dd>The visits and hours they logged stay in the year’s counts as “a former member”.</dd>
          </div>
        </dl>
        <Label htmlFor="people-remove-name">Type {person.name} to remove them</Label>
        <Input id="people-remove-name" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="words" spellCheck={false} />
        <p className="for-good-last">This cannot be undone.</p>
        {failed && <LiveFailure message={failed} kept="Nothing was removed." />}
        <div className="live-form-actions">
          <Button type="submit" className="for-good-confirm" disabled={!matches || busy}>
            {busy ? "Removing" : "Remove this person"}
          </Button>
        </div>
      </form>
    </LiveDialog>
  );
}

export function PeopleSection() {
  const { data, pending, isOwner, confirm: setConfirmation, words } = useWorkspace();
  // The owner's tools here are English, so they name the place in English: a conference, or a group.
  const group = wordsFor("en", data.church.wordSet).terms.group;
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
                      title: `${managing.active ? "Remove" : "Restore"} ${group} access?`,
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
          </div>
          {/* The one act here that cannot be undone: a quiet link under a hairline, as on a neighbor's record. */}
          <p className="for-good">
            <Button variant="ghost" className="for-good-open" disabled={pending} onClick={() => setRemoving(true)}>
              Remove this person for good
            </Button>
            <span className="live-count help-private">
              <Lock size={14} aria-hidden="true" /> Owners only
            </span>
          </p>
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
              Invite people when you’re ready to bring them into this {group}.
            </LiveEmpty>
          )}
        </section>
      )}
    </>
  );
}
