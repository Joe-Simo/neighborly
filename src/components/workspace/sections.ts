import { lazy, type ComponentType } from "react";
import { liveAreas, type LiveArea } from "@/components/workspace/areas";

// Each room is its own file, fetched when it is needed: the room being opened at once, beside the frame, and every other room once the first is whole and the page is idle, so moving between rooms never waits on a fetch.
const loaders: Record<LiveArea, () => Promise<ComponentType>> = {
  week: () => import("@/components/workspace/volunteer/week").then((room) => room.WeekSection),
  team: () => import("@/components/workspace/volunteer/teams").then((room) => room.TeamsSection),
  people: () => import("@/components/workspace/volunteer/people").then((room) => room.PeopleSection),
  commitments: () => import("@/components/workspace/volunteer/commitments").then((room) => room.CommitmentsSection),
  mine: () => import("@/components/workspace/volunteer/mine").then((room) => room.MineSection),
  "time-off": () => import("@/components/workspace/volunteer/time-off").then((room) => room.TimeOffSection),
  tasks: () => import("@/components/workspace/volunteer/tasks").then((room) => room.TasksSection),
  "help-line": () => import("@/components/workspace/help-line/help-line").then((room) => room.HelpLineSection),
  neighbors: () => import("@/components/workspace/help-line/neighbors").then((room) => room.NeighborsSection),
  treasury: () => import("@/components/workspace/treasury/treasury").then((room) => room.TreasurySection),
  reports: () => import("@/components/workspace/reports/reports").then((room) => room.ReportsSection),
  visits: () => import("@/components/workspace/visits/visits").then((room) => room.VisitsSection),
  tools: () => import("@/components/workspace/tools/tools").then((room) => room.ToolsSection),
};

const asked = new Map<LiveArea, Promise<ComponentType>>();
const arrived = new Map<LiveArea, ComponentType>();
/** Fetches a room's code once; every later ask shares the same answer. */
export function fetchRoom(area: LiveArea) {
  let room = asked.get(area);
  if (!room)
    asked.set(
      area,
      (room = loaders[area]().then((code) => {
        arrived.set(area, code);
        return code;
      })),
    );
  return room;
}

/** Every room not yet fetched, asked for when the browser has nothing else to do. */
export function fetchRoomsAhead() {
  const all = () => liveAreas.forEach((area) => void fetchRoom(area));
  if ("requestIdleCallback" in window) window.requestIdleCallback(all, { timeout: 4000 });
  else setTimeout(all, 1500);
}

const room = (area: LiveArea) => lazy(() => fetchRoom(area).then((code) => ({ default: code })));
const sections: Record<LiveArea, ComponentType> = {
  week: room("week"),
  team: room("team"),
  people: room("people"),
  commitments: room("commitments"),
  mine: room("mine"),
  "time-off": room("time-off"),
  tasks: room("tasks"),
  "help-line": room("help-line"),
  neighbors: room("neighbors"),
  treasury: room("treasury"),
  reports: room("reports"),
  visits: room("visits"),
  tools: room("tools"),
};

/**
 * The room to draw: its own code once that has arrived, so the room is drawn at once (a lazy room is first drawn
 * as its wait, and React keeps a wait on screen at least 300ms); until then a lazy room that waits for its code.
 */
export const roomSection = (area: LiveArea) => arrived.get(area) ?? sections[area];

// The room in the address is asked for the moment this file runs, alongside the frame's own code, not after it.
if (typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
  const named = window.location.pathname.split("/")[2];
  void fetchRoom(liveAreas.find((area) => area === named) ?? "week");
}
