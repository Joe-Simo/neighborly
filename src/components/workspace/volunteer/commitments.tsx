"use client";

import { upcomingCommitments } from "@/lib/commitment-visibility";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { CommitmentRows } from "@/components/workspace/volunteer/commitment-rows";

export function CommitmentsSection() {
  const { data, now, teamFilter, setTeamFilter, words } = useWorkspace();
  const text = words.commitments;
  const datedCommitments = upcomingCommitments(data.commitments, now, true);
  return (
    <>
      <div className="live-filter">
        <NativeSelect
          aria-label={text.filterLabel}
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
        >
          <option value="">{text.allTeams}</option>
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
          ? { title: text.noneForTeamTitle, detail: text.noneForTeamDetail }
          : undefined
        }
      />
    </>
  );
}
