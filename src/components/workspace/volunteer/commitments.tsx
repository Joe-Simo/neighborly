"use client";

import { upcomingCommitments } from "@/lib/commitment-visibility";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { WeekByTeam } from "@/components/workspace/volunteer/asides";
import { CommitmentRows } from "@/components/workspace/volunteer/commitment-rows";

export function CommitmentsSection() {
  const { data, now, teamFilter, setTeamFilter, words, sampleSaid, isOwner, format } = useWorkspace();
  const text = words.commitments;
  const datedCommitments = upcomingCommitments(data.commitments, now, true);
  const shown = datedCommitments.filter((item) => !teamFilter || item.teamId === teamFilter);
  // Each week is named before its first row. A week starts on Sunday in the group's own calendar, and its name
  // (the Sunday's date, in the reader's language) is also what tells one week from the next.
  const sunday = new Intl.DateTimeFormat("en-US", { timeZone: data.church.timeZone, weekday: "short" });
  const weeks: Record<string, string> = {};
  let last = "";
  for (const item of shown) {
    const back = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(sunday.format(item.start));
    const week = words.commitments.weekOf(format(item.start - back * 86_400_000, { weekday: undefined, month: "long", day: "numeric" }));
    if (week !== last) weeks[item.id] = last = week;
  }
  return (
    <>
      <WeekByTeam />
      <h2 className="sr-only">{words.menu.commitments}</h2>
      {/* A filter over nothing filters nothing: it comes with the first upcoming commitment. */}
      {datedCommitments.length > 0 && <div className="live-filter">
        <NativeSelect
          aria-label={text.filterLabel}
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
        >
          <option value="">{text.allTeams}</option>
          {data.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {sampleSaid(team.name)}
            </option>
          ))}
        </NativeSelect>
      </div>}
      <CommitmentRows
        items={shown}
        weeks={weeks}
        empty={
          teamFilter && datedCommitments.length > 0
          ? { title: text.noneForTeamTitle, detail: text.noneForTeamDetail }
          : isOwner ? undefined : { title: words.commitments.emptyTitle, detail: words.commitments.emptyDetail, go: "week" }
        }
      />
    </>
  );
}
