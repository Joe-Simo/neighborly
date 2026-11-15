"use client";

import { upcomingCommitments } from "@/lib/commitment-visibility";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { CommitmentRows } from "@/components/workspace/volunteer/commitment-rows";

export function CommitmentsSection() {
  const { data, now, teamFilter, setTeamFilter } = useWorkspace();
  const datedCommitments = upcomingCommitments(data.commitments, now, true);
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <NativeSelect
          aria-label="Filter by team"
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
        >
          <option value="">All teams</option>
          {data.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <CommitmentRows
        items={datedCommitments.filter(
          (item) => !teamFilter || item.teamId === teamFilter,
        )}
        empty={
          teamFilter
          ? { title: "No upcoming dates for this team.", detail: "Choose another team or view all teams to see the rest of your group’s commitments." }
          : undefined
        }
      />
    </>
  );
}
