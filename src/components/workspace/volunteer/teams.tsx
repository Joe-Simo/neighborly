"use client";

import "./people.css";
import { useState } from "react";
import { Plus } from "lucide-react";
import { usePaginatedQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveEmpty } from "@/components/workspace/primitives";
import { LiveFailure, useConnectionLost } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/context";
import { initials } from "@/components/workspace/volunteer/people";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

export function TeamsSection() {
  const { data, pending, isOwner, perform, words, sampleSaid } = useWorkspace();
  const t = words.teams;
  const text = words.rooms.peopleRoom.teams;
  // Each opening of the dialog is its own object, so an answer that comes late can tell whether the person is
  // still in the opening it was asked from, even if the same team's dialog has been opened again since.
  const [addingTo, setAddingTo] = useState<{ team: LiveWorkspaceData["teams"][number] } | null>(null);
  // The opening an add now on its way was sent from: only there is the wait for the connection said.
  const [sentFrom, setSentFrom] = useState<typeof addingTo>(null);
  const lost = useConnectionLost();
  // Teams joined in this visit: their slip stays, folded green, so the yes is seen to land.
  const [joined, setJoined] = useState<string[]>([]);
  // A failed add is said inside the dialog, where the person is looking: the page's own line sits behind the
  // dialog, unseen and unannounced. The dialog stays open with its list as it was, and the notice takes the focus
  // the pressed button gave up while it was at rest. It is taken away as the next try starts, so a second
  // failure is a new notice and is announced again.
  // It is kept with the opening it happened in, so it is never shown in a dialog opened afterwards.
  const [failedIn, setFailedIn] = useState<typeof addingTo>(null);
  const candidates = addingTo ? data.people.filter((person) => person.active && !addingTo.team.memberIds.includes(person.id)) : [];
  return (
    <div className="live-grid live-teams paper-rows">
      {data.teams.length ? (
        data.teams.map((team) => (
          <section className="live-team team-card" key={team.id}>
            <h2>{sampleSaid(team.name)}</h2>
            <p>
              {team.description || t.noDescription}
            </p>
            {joined.includes(team.id) ? (
              <div className="team-asked paper-corner paper-fold" role="status">
                <p>{t.onTeam}</p>
              </div>
            ) : (
              team.myInvitation && (
                <div className="team-asked paper-corner paper-waits paper-settle">
                  <p>
                    {t.invited}
                  </p>
                  <div className="live-row-actions">
                    <Button
                      disabled={pending}
                      size="sm"
                      aria-label={`${t.join}: ${sampleSaid(team.name)}`}
                      onClick={async () => {
                        if (await perform({ type: "respondTeam", teamId: team.id, accept: true }))
                          setJoined((teams) => [...teams, team.id]);
                      }}
                    >
                      {t.join}
                    </Button>
                    <Button
                      disabled={pending}
                      size="sm"
                      variant="ghost"
                      aria-label={`${t.decline}: ${sampleSaid(team.name)}`}
                      onClick={() => void perform({ type: "respondTeam", teamId: team.id, accept: false })}
                    >
                      {t.decline}
                    </Button>
                  </div>
                </div>
              )
            )}
            <LiveTeamRoster
              data={data}
              team={team}
              isOwner={isOwner}
              run={perform}
              pending={pending}
              add={() => setAddingTo({ team })}
            />
          </section>
        ))
      ) : (
        <LiveEmpty title={t.emptyTitle}>
          {text.emptyBody}
        </LiveEmpty>
      )}
      {addingTo && (
        <LiveDialog
          title={text.addTo(sampleSaid(addingTo.team.name))}
          description={text.addDeck}
          onClose={() => setAddingTo(null)}
        >
          {candidates.length ? (
            <div className="live-list team-candidates">
              {candidates.map((person) => (
                <div className="live-row" key={person.id}>
                  <div className="live-person">
                    <span className="live-avatar" aria-hidden="true">{initials(person.name)}</span>
                    <h3>{person.name}</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-label={text.addLabel(person.name)}
                    onClick={async () => {
                      const from = addingTo;
                      setFailedIn(null);
                      setSentFrom(from);
                      const added = await perform({ type: "setTeamMember", teamId: from.team.id, personId: person.id, member: true });
                      setSentFrom((now) => (now === from ? null : now));
                      // The answer may come long after (a held save): it closes only the opening it was sent
                      // from, and a failure is said only there.
                      if (added) setAddingTo((now) => (now === from ? null : now));
                      else setFailedIn(from);
                    }}
                  >
                    {text.add}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p>{text.everyone}</p>
          )}
          {/* Below the list, so nothing above it moves when it comes. Nothing was typed here, so there is no second line about what was kept. */}
          {failedIn === addingTo && <LiveFailure message={words.states.notSaved} kept="" />}
          {/* With the connection lost the add is held, not failed. Nothing was typed here, so the line is the one
              about changes being sent, not the one about what was typed. */}
          {sentFrom === addingTo && pending && lost && (
            <p className="live-waiting" role="status">
              {words.states.offlineDeck}
            </p>
          )}
        </LiveDialog>
      )}
    </div>
  );
}

function LiveTeamRoster({
  data,
  team,
  isOwner,
  run,
  pending,
  add,
}: {
  data: LiveWorkspaceData;
  team: LiveWorkspaceData["teams"][number];
  isOwner: boolean;
  run: (command: LiveCommand) => Promise<boolean>;
  pending: boolean;
  add: () => void;
}) {
  const { words, sampleSaid } = useWorkspace();
  const t = words.teams;
  const text = words.rooms.peopleRoom.teams;
  const [open, setOpen] = useState(false);
  const roster = usePaginatedQuery(
    api.pages.teamRosterPage,
    open ? { churchId: data.church.id, teamId: team.id } : "skip",
    { initialNumItems: 20 },
  );
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = roster.results.find((person) => person.personId === managingId);
  // One choice at a time: the dialog closes as the choice is sent, and the row shows what came of it.
  const choose = (command: LiveCommand) => {
    setManagingId(null);
    void run(command);
  };
  const faces = team.memberIds.flatMap((id) => data.people.find((person) => person.id === id) ?? []).slice(0, 4);
  return (
    <div>
      <div className="live-team-line">
        <div className="team-faces">
          {faces.map((person) => (
            <span className="live-avatar" key={person.id} aria-hidden="true">
              {initials(person.name)}
            </span>
          ))}
          <span className="live-meta">
            {t.members(team.memberIds.length)}
          </span>
        </div>
        {!team.myInvitation && (
          <Button variant="link" className="tools-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t.hideMembers : t.viewMembers}
          </Button>
        )}
        {team.canCoordinate && (
          <Button variant="outline" size="sm" onClick={add}>
            <Plus size={15} aria-hidden="true" /> {text.addMember}
          </Button>
        )}
      </div>
      {managing && (
        <LiveDialog
          title={managing.name}
          description={<>{sampleSaid(team.name)} · {managing.role === "coordinator" ? t.coordinator : t.member}</>}
          onClose={() => setManagingId(null)}
        >
          <div className="live-manage">
            {managing.status === "active" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => choose({ type: "setTeamApproval", teamId: team.id, personId: managing.personId, approved: !managing.approved })}
                >
                  {managing.approved ? text.markNotReady : text.markReady}
                  <small>
                    {managing.approved
                      ? text.markNotReadyNote
                      : text.markReadyNote}
                  </small>
                </Button>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      choose({
                        type: "setTeamRole",
                        teamId: team.id,
                        personId: managing.personId,
                        role: managing.role === "coordinator" ? "member" : "coordinator",
                      })
                    }
                  >
                    {managing.role === "coordinator" ? text.makeMember : text.makeCoordinator}
                    <small>
                      {managing.role === "coordinator"
                        ? text.makeMemberNote
                        : text.makeCoordinatorNote}
                    </small>
                  </Button>
                )}
              </>
            )}
            {managing.status === "active" && <hr className="team-apart" />}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => choose({ type: "setTeamMember", teamId: team.id, personId: managing.personId, member: false })}
            >
              {managing.status === "invited" ? text.withdrawInvitation : text.removeFromTeam}
              <small>
                {managing.status === "invited"
                  ? text.withdrawInvitationNote
                  : text.removeFromTeamNote}
              </small>
            </Button>
          </div>
        </LiveDialog>
      )}
      {open && (
        <>
          <div className="live-list team-roster">
            {roster.results.map((person) => (
              <div className="live-row" key={person.personId}>
                <div className="live-person">
                  <span className="live-avatar" aria-hidden="true">{initials(person.name)}</span>
                  <div>
                    <h3>{person.name}</h3>
                    <p data-waits={person.status === "invited" || !person.approved ? "" : undefined}>
                      {person.role === "coordinator" ? t.coordinator : t.member}
                      {person.status === "invited"
                        ? ` · ${t.invitedWaiting}`
                        : !person.approved && ` · ${t.waitingApproval}`}
                    </p>
                  </div>
                </div>
                {team.canCoordinate && (
                  <div className="live-row-actions">
                    <Button variant="outline" size="sm" aria-label={text.manageLabel(person.name)} onClick={() => setManagingId(person.personId)}>
                      {text.manage}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {roster.status !== "Exhausted" && (
            <Button
              className="team-more"
              variant="outline"
              disabled={roster.status !== "CanLoadMore"}
              onClick={() => roster.loadMore(20)}
            >
              {roster.status === "CanLoadMore"
                ? t.loadMore
                : t.loading}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
