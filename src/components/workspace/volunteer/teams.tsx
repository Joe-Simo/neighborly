"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

export function TeamsSection() {
  const { data, pending, isOwner, perform } = useWorkspace();
  return (
    <div className="live-grid">
      {data.teams.length ? (
        data.teams.map((team) => (
          <section className="live-team" key={team.id}>
            <h2>{team.name}</h2>
            <p>
              {team.description || "A team with room to contribute."}
            </p>
            {team.myInvitation && (
              <div className="live-note">
                <p>
                  You’re invited to this team. Joining does not accept a
                  commitment.
                </p>
                <div className="live-row-actions">
                  <Button
                    disabled={pending}
                    size="sm"
                    onClick={() =>
                      void perform({
                        type: "respondTeam",
                        teamId: team.id,
                        accept: true,
                      })
                    }
                  >
                    Join team
                  </Button>
                  <Button
                    disabled={pending}
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void perform({
                        type: "respondTeam",
                        teamId: team.id,
                        accept: false,
                      })
                    }
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}
            <div className="live-meta">
              {team.memberIds.length}{" "}
              {team.memberIds.length === 1 ? "member" : "members"}
            </div>
            {!team.myInvitation && (
              <LiveTeamRoster
                data={data}
                team={team}
                isOwner={isOwner}
                run={perform}
                pending={pending}
              />
            )}
            {team.canCoordinate && (
              <NativeSelect
                aria-label={`Add a member to ${team.name}`}
                value=""
                disabled={pending}
                onChange={(event) => {
                  const person = data.people.find(
                    (item) => item.id === event.target.value,
                  );
                  if (person)
                    void perform({
                      type: "setTeamMember",
                      teamId: team.id,
                      personId: person.id,
                      member: true,
                    });
                }}
              >
                <option value="">Add a member…</option>
                {data.people
                  .filter(
                    (person) => !team.memberIds.includes(person.id),
                  )
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </section>
        ))
      ) : (
        <LiveEmpty title="Start with one team.">
          Give your first team a name, then add people when they join
          your group workspace.
        </LiveEmpty>
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
}: {
  data: LiveWorkspaceData;
  team: LiveWorkspaceData["teams"][number];
  isOwner: boolean;
  run: (command: LiveCommand) => Promise<boolean>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const roster = usePaginatedQuery(
    api.pages.teamRosterPage,
    open ? { churchId: data.church.id, teamId: team.id } : "skip",
    { initialNumItems: 20 },
  );
  return (
    <div style={{ marginTop: 20 }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        {open ? "Hide members" : "View members"}
      </Button>
      {open && (
        <>
          <div className="live-list" style={{ marginTop: 18 }}>
            {roster.results.map((person) => (
              <div className="live-row" key={person.personId}>
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.status === "invited"
                      ? "Invitation pending"
                      : person.approved
                        ? "Approved for this team"
                        : "Team approval pending"}{" "}
                    · {person.role}
                  </p>
                </div>
                {team.canCoordinate && (
                  <div className="live-row-actions">
                    {person.status === "active" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void run({
                              type: "setTeamApproval",
                              teamId: team.id,
                              personId: person.personId,
                              approved: !person.approved,
                            })
                          }
                        >
                          {person.approved
                            ? "Revoke approval"
                            : "Approve for team"}
                        </Button>
                        {isOwner && (
                          <NativeSelect
                            aria-label={`Team role for ${person.name}`}
                            value={person.role}
                            disabled={pending}
                            onChange={(event) =>
                              void run({
                                type: "setTeamRole",
                                teamId: team.id,
                                personId: person.personId,
                                role:
                                  event.target.value === "coordinator"
                                    ? "coordinator"
                                    : "member",
                              })
                            }
                          >
                            <option value="member">Member</option>
                            <option value="coordinator">Coordinator</option>
                          </NativeSelect>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run({
                          type: "setTeamMember",
                          teamId: team.id,
                          personId: person.personId,
                          member: false,
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {roster.status !== "Exhausted" && (
            <Button
              style={{ marginTop: 16 }}
              variant="outline"
              disabled={roster.status !== "CanLoadMore"}
              onClick={() => roster.loadMore(20)}
            >
              {roster.status === "CanLoadMore"
                ? "Load more members"
                : "Loading members…"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
