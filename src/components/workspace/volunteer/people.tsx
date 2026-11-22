"use client";

import { numberLocales } from "@/lib/words/numbers";
import { keepTitle } from "@/lib/words/titles";
import "./people.css";
import "@/components/workspace/for-good.css";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { NameToConfirm } from "@/components/workspace/help-line/name-to-confirm";
import { sayFailure } from "@/components/workspace/failure";
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
function Address({ email, oneLine }: { email: string; oneLine?: boolean }) {
  const at = email.lastIndexOf("@");
  return (
    // Read as one address (WebKit's role="text"), not as its two drawn pieces.
    <span className="people-address" data-one-line={oneLine ? "" : undefined} title={email} role="text" aria-label={email}>
      <span>{at < 0 ? email : email.slice(0, at)}</span>
      {at >= 0 && <span>{email.slice(at)}</span>}
    </span>
  );
}

/** The second step of removing someone for good: what goes, what stays, and their name typed before the button wakes. */
function RemoveForGood({ person, churchId, onClose }: { person: LiveWorkspaceData["people"][number]; churchId: LiveWorkspaceData["church"]["id"]; onClose: () => void }) {
  const remove = useMutation(api.people.remove);
  const { words } = useWorkspace();
  const text = words.rooms.peopleRoom.remove;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  // The same reading of a name the backend and the name box make.
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const matches = key(typed) === key(person.name);
  return (
    <LiveDialog title={text.title} description={text.deck(person.name)} onClose={onClose}>
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
            setFailed(sayFailure(words.notices,cause, text.failed, words.states.offlineSave));
            setBusy(false);
          }
        }}
      >
        <dl className="for-good-terms">
          <div>
          <dt>{text.goes}</dt>
          <dd>{text.goesDetail}</dd>
          </div>
          <div>
          <dt>{text.stays}</dt>
          <dd>{text.staysDetail}</dd>
          </div>
        </dl>
        <NameToConfirm label={text.typeName(person.name)} name={person.name} typed={typed} onTyped={setTyped} />
        <p className="for-good-last">{text.last}</p>
        {failed && <LiveFailure message={failed} kept={text.kept} />}
        <div className="live-form-actions">
          <Button type="submit" className="for-good-confirm" disabled={!matches || busy}>
            {busy ? text.removing : text.confirm}
          </Button>
        </div>
      </form>
    </LiveDialog>
  );
}

export function PeopleSection() {
  const { data, pending, isOwner, confirm: setConfirmation, words, sampleSaid, now, openAction } = useWorkspace();
  const roles: Record<string, string> = words.people.roles;
  const text = words.rooms.peopleRoom;
  const sheets = words.rooms.sheets;
  const invitedAs: Record<string, string> = text.invitations.invitedAs;
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = data.people.find((person) => person.id === managingId);
  const [removing, setRemoving] = useState(false);
  return (
    <>
      {/* The rows are titled h3, so the list carries the h2 a screen reader steps by. */}
      <h2 className="sr-only">{words.menu.people}</h2>
      {/* The one figure as paper: those who can be asked to serve, on a cut slip over the list. */}
      {(() => {
        const ready = data.people.filter((person) => person.active && person.approved).length;
        return (
          <div className="room-tally people-tally">
            <dl>
              <div>
                <dt>{text.readyCount(ready)}</dt>
                <dd><b>{new Intl.NumberFormat(numberLocales[words.locale]).format(ready)}</b></dd>
              </div>
            </dl>
          </div>
        );
      })()}
      <div className="live-list">
        {data.people.map((person) => {
          // Only the owner has anything to open, and never on an owner's own row.
          const opens = isOwner && person.role !== "owner";
          const name = sampleSaid(person.name);
          return (
          <div className="live-row live-person-row people-row" key={person.id} data-away={person.active ? undefined : ""} data-opens={opens ? "" : undefined}>
            <div className="live-person">
              <span className="live-avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <div>
                <h3>
                  {opens ? (
                    // The one control of the row: its target is the whole row (people.css).
                    <button type="button" className="people-row-open" aria-label={text.manage.open(name)} onClick={() => setManagingId(person.id)}>
                      {keepTitle(name)}
                    </button>
                  ) : (
                    name
                  )}
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
              {opens && <ArrowRight className="people-row-go" size={20} aria-hidden="true" />}
            </div>
          </div>
          );
        })}
      </div>
      {managing && (
        removing ? (
          <RemoveForGood person={managing} churchId={data.church.id} onClose={() => { setRemoving(false); setManagingId(null); }} />
        ) : (
        <LiveDialog title={managing.name} description={<><span className="people-address-full">{managing.email.slice(0, managing.email.lastIndexOf("@"))}<wbr />{managing.email.slice(managing.email.lastIndexOf("@"))}</span>{managing.active ? (roles[managing.role] ?? managing.role) : words.people.removed} · {managing.approved ? text.manage.ready : words.people.waiting}</>} onClose={() => setManagingId(null)}>
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
                        ? text.manage.markNotReadyTitle(managing.name)
                        : text.manage.markReadyTitle(managing.name),
                      body: managing.approved
                        ? text.manage.markNotReadyBody
                        : text.manage.markReadyBody,
                      action: managing.approved ? text.manage.markNotReady : text.manage.markReady,
                      done: managing.approved ? sheets.done.markedNotReady(managing.name) : sheets.done.markedReady(managing.name),
                      command: {
                        type: "setApproval",
                        personId: managing.id,
                        approved: !managing.approved,
                      },
                    });
                  }}
                >
                  {managing.approved ? text.manage.markNotReady : text.manage.markReady}
                  <small>{managing.approved ? text.manage.markNotReadyNote : text.manage.markReadyNote}</small>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    {
                    setManagingId(null);
                    setConfirmation({
                      title: managing.active ? text.manage.removeAccessTitle : text.manage.restoreAccessTitle,
                      action: managing.active ? text.manage.removeAccess : text.manage.restoreAccess,
                      body: text.manage.accessBody,
                      done: managing.active ? sheets.done.accessRemoved(managing.name) : sheets.done.accessRestored(managing.name),
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
                  {managing.active ? text.manage.removeAccess : text.manage.restoreAccess}
                  <small>{managing.active ? text.manage.removeAccessNote : text.manage.restoreAccessNote}</small>
                </Button>
          </div>
          {/* The one act here that cannot be undone: a quiet link under a hairline, as on a neighbor's record. */}
          <p className="for-good">
            <Button variant="ghost" className="for-good-open" disabled={pending} onClick={() => setRemoving(true)}>
              {text.manage.forGood}
            </Button>
            <span className="live-count help-private">
              <Lock size={14} aria-hidden="true" /> {text.manage.ownersOnly}
            </span>
          </p>
        </LiveDialog>
        )
      )}
      {/* A member can read the list but not act on it: the next step is their own commitments, as in the rooms kept private. */}
      {!isOwner && (
        <p className="tools-quiet">
          <Button variant="outline" asChild>
            <Link href="/app/mine">{words.menu.mine}</Link>
          </Button>
        </p>
      )}
      {isOwner && (
        <section className="live-section">
          <h2 className={data.invitations.length ? undefined : "sr-only"}>{text.invitations.title}</h2>
          {/* With none open, the empty state below says what an invitation is: the deck would say it twice. */}
          {data.invitations.length > 0 && <p className="live-deck people-deck">
            {text.invitations.deck}
          </p>}
          {data.invitations.length ? (
            // Rows like the people above, in the same columns. No folded corner: this wait is on someone else.
            <div className="live-list people-invitations">
              {data.invitations.map((invite) => {
                // A pending link past its day cannot be used: it says so, in ochre, and offers a new one.
                const expired = invite.status === "pending" && invite.expiresAt !== undefined && invite.expiresAt <= now;
                const waits = invite.status === "pending" && !expired;
                const role = invitedAs[invite.role] ?? text.invitations.invitedAsOther(invite.role.toLowerCase());
                return (
                  <div className="live-row live-person-row people-row people-invited" key={invite.id}>
                    <div className="live-person">
                      <span className="live-avatar" aria-hidden="true">
                        <Mail size={18} />
                      </span>
                      <div>
                        <h3>
                          <Address email={invite.email} oneLine />
                          <span className="people-role">{role}</span>
                        </h3>
                      </div>
                    </div>
                    <div className="live-meta">
                      <span className="people-role-wide">{role}</span>
                      <span data-waits={waits || expired ? "" : undefined} data-joined={invite.status === "accepted" ? "" : undefined}>
                        {expired ? text.invitations.expired : waits ? text.invitations.waiting : invite.status === "accepted" ? text.invitations.joined : invite.status}
                      </span>
                    </div>
                    <div className="live-row-actions">
                      {expired && (
                        <Button variant="ghost" size="sm" data-opens="" disabled={pending} onClick={() => openAction("invite")}>
                          {text.invitations.sendNew}
                        </Button>
                      )}
                      {(waits || expired) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          aria-label={text.invitations.revokeLabel(invite.email)}
                          onClick={() =>
                            setConfirmation({
                              title: text.invitations.revokeTitle,
                              body: text.invitations.revokeBody,
                              action: text.invitations.revoke,
                              done: sheets.done.inviteWithdrawn(invite.email),
                              command: {
                                type: "revokeInvitation",
                                invitationId: invite.id,
                              },
                            })
                          }
                        >
                          {text.invitations.revoke}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <LiveEmpty title={text.invitations.emptyTitle}>
              {text.invitations.emptyBody}
            </LiveEmpty>
          )}
        </section>
      )}
    </>
  );
}
