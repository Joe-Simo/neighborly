"use client";

import "./people.css";
import { useState } from "react";
import { Plus } from "lucide-react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { initials } from "@/components/workspace/volunteer/people";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

export function TeamsSection() {
  const { data, pending, isOwner, perform, words } = useWorkspace();
  const t = words.teams;
  const [addingTo, setAddingTo] = useState<LiveWorkspaceData["teams"][number] | null>(null);
  // Teams joined in this visit: their slip stays, folded green, so the yes is seen to land.
  const [joined, setJoined] = useState<string[]>([]);
  const candidates = addingTo ? data.people.filter((person) => person.active && !addingTo.memberIds.includes(person.id)) : [];
  return (
    <div className="live-grid live-teams paper-rows">
      {data.teams.length ? (
        data.teams.map((team) => (
          <section className="live-team team-card" key={team.id}>
            <h2>{team.name}</h2>
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
              add={() => setAddingTo(team)}
            />
          </section>
        ))
      ) : (
        <LiveEmpty title={t.emptyTitle}>
          Give your first team a name, then add people when they join
          your group workspace.
        </LiveEmpty>
      )}
      {addingTo && (
        <LiveDialog
          title={`Add a member to ${addingTo.name}`}
          description="They get an invitation to the team. Joining never accepts a commitment for them."
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
                    aria-label={`Add ${person.name}`}
                    onClick={async () => {
                      if (await perform({ type: "setTeamMember", teamId: addingTo.id, personId: person.id, member: true }))
                        setAddingTo(null);
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p>Everyone in your group is already on this team.</p>
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
  const t = useWorkspace().words.teams;
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
            <Plus size={15} aria-hidden="true" /> Add a member
          </Button>
        )}
      </div>
      {managing && (
        <LiveDialog
          title={managing.name}
          description={<>{team.name} · {managing.role === "coordinator" ? "Coordinator" : "Member"}</>}
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
                  {managing.approved ? "Revoke approval for this team" : "Approve for this team"}
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
                    {managing.role === "coordinator" ? "Make a member of this team" : "Make a coordinator of this team"}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => choose({ type: "setTeamMember", teamId: team.id, personId: managing.personId, member: false })}
            >
              {managing.status === "invited" ? "Withdraw the invitation" : "Remove from this team"}
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
                    <Button variant="outline" size="sm" aria-label={`Manage ${person.name}`} onClick={() => setManagingId(person.personId)}>
                      Manage
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
