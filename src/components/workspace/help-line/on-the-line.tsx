"use client";

import { RoomAside } from "@/components/workspace/aside";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import type { Calls } from "@/components/workspace/help-line/format";

type Turn = { id: string; when: string; name: string | null };
type Owner = { name: string | null; calls: number };

/** Today's turns on the Help line team, from the commitments the workspace already holds, in the conference's own day. */
export function turnsToday({ data, now, format }: Pick<Workspace, "data" | "now" | "format">): Turn[] {
  const team = data.teams.find((one) => one.name.trim().toLowerCase() === "help line");
  if (!team) return [];
  const day = (time: number) => format(time, { year: "numeric" });
  const hour = (time: number) => format(time, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" });
  return data.commitments
    .filter((turn) => turn.teamId === team.id && turn.status !== "cancelled" && day(turn.start) === day(now))
    .sort((a, b) => a.start - b.start)
    .map((turn) => ({
      id: turn.id,
      when: `${hour(turn.start)}–${hour(turn.end)}`,
      name: data.people.find((person) => person.id === turn.assigneeId)?.name ?? null,
    }));
}

/** Who holds the calls still to return, most first; a call nobody holds yet comes last. */
export function owners(waiting: Calls["waiting"]): Owner[] {
  const held = new Map<string | null, number>();
  for (const call of waiting) held.set(call.ownerName ?? null, (held.get(call.ownerName ?? null) ?? 0) + 1);
  return [...held]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => Number(a.name === null) - Number(b.name === null) || b.calls - a.calls);
}

/** The Help line's side column on a wide screen: who is on the line today, and who is calling back. */
export function OnTheLine({ turns, calling }: { turns: Turn[]; calling: Owner[] }) {
  const text = useWorkspace().words.rooms.helpLine.aside;
  return (
    <RoomAside title={text.title}>
      {turns.length ? (
        <ul className="help-aside-list">
          {turns.map((turn) => (
            <li key={turn.id}>
              <strong data-open={turn.name ? undefined : ""}>{turn.name ?? text.noOne}</strong>
              <span>{turn.when}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="help-aside-none">{text.none}</p>
      )}
      {calling.length > 0 && (
        <>
          <h3 className="live-kicker">{text.callingBack}</h3>
          <ul className="help-aside-list">
            {calling.map((owner) => (
              <li key={owner.name ?? ""}>
                <strong data-open={owner.name ? undefined : ""}>{owner.name ?? text.noOne}</strong>
                <span>{text.calls(owner.calls)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </RoomAside>
  );
}
