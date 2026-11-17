import { createElement, use, type ComponentType } from "react";
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
/**
 * Fetches a room's code once; every later ask shares the same answer. A fetch that failed (no connection, a
 * release that took the file away) is forgotten, so the next ask really fetches again and "Try again" can work.
 */
export function fetchRoom(area: LiveArea) {
  let room = asked.get(area);
  if (!room) {
    const fetched = loaders[area]().then(
      (code) => {
        arrived.set(area, code);
        return code;
      },
      (fault: unknown) => {
        if (asked.get(area) === fetched) asked.delete(area);
        throw fault;
      },
    );
    asked.set(area, (room = fetched));
  }
  return room;
}

/** Every room not yet fetched, asked for when the browser has nothing else to do. */
export function fetchRoomsAhead() {
  // A room fetched ahead that does not come is no fault to anyone: it is fetched again when it is opened.
  const all = () => liveAreas.forEach((area) => void fetchRoom(area).catch(() => {}));
  if ("requestIdleCallback" in window) window.requestIdleCallback(all, { timeout: 4000 });
  else setTimeout(all, 1500);
}

/** The fetch a room on the page is waiting on, and how it failed if it did. */
type Reading = { wait: Promise<ComponentType>; fault?: { error: unknown } };
const reading = new Map<LiveArea, Reading>();
/**
 * A room that waits for its code. It is not React's `lazy`, which keeps a failed fetch for good: the room's "Try
 * again" (RoomBoundary) draws this same room again, and a kept failure would fail again without asking.
 * A failed fetch is forgotten by the failure itself, a moment after it happens, whether or not the room is still
 * on the page: a room left while it was still opening must not keep an old failure to show the next time it is
 * opened. It is a moment after and not at once because React draws the waiting room again when the fetch fails,
 * and then a second time before it gives up on it; those drawings must find the failure, not start another fetch.
 */
const faultKeptMs = 1000;
const room = (area: LiveArea): ComponentType =>
  function Room() {
    // Once this room has waited, every later drawing of it reads the same fetch through `use`, also after the code
    // has arrived: React holds a component to the way it waited (a drawing that skipped `use` was reported as a fault
    // in the console), and a fetch that has been read answers at once. A room entered after its code arrived never
    // comes here (roomSection).
    let read = reading.get(area);
    if (!read) {
      const next: Reading = { wait: fetchRoom(area) };
      const forget = () => {
        if (reading.get(area) === next) reading.delete(area);
      };
      next.wait.then(forget, (error: unknown) => {
        next.fault = { error };
        setTimeout(forget, faultKeptMs);
      });
      reading.set(area, (read = next));
    }
    if (read.fault) throw read.fault.error;
    return createElement(use(read.wait));
  };
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
 * The room to draw: its own code once that has arrived, so the room is drawn at once (a waiting room is first drawn
 * as its wait, and React keeps a wait on screen at least 300ms); until then a room that waits for its code.
 */
export const roomSection = (area: LiveArea) => arrived.get(area) ?? sections[area];

// The room in the address is asked for the moment this file runs, alongside the frame's own code, not after it.
if (typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
  const named = window.location.pathname.split("/")[2];
  // If it does not come, the room itself asks again when it is drawn, and says so if that fails too.
  void fetchRoom(liveAreas.find((area) => area === named) ?? "week").catch(() => {});
}
