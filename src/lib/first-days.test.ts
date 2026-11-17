import { describe, expect, test } from "bun:test";
import { isBrandNew, nothingWaiting, type FirstDaysData } from "./first-days";

const alone: FirstDaysData = {
  user: { id: "m1" },
  people: [{ id: "m1", role: "owner" }],
  teams: [],
  commitments: [],
  announcements: [],
  tasks: [],
  meetings: [],
};

describe("isBrandNew", () => {
  test("the owner alone with nothing made", () => {
    expect(isBrandNew(alone)).toBe(true);
  });
  test("not once anyone else has joined", () => {
    expect(isBrandNew({ ...alone, people: [...alone.people, { id: "m2", role: "volunteer" }] })).toBe(false);
  });
  test("not for a volunteer who sees only themselves", () => {
    expect(isBrandNew({ ...alone, people: [{ id: "m1", role: "volunteer" }] })).toBe(false);
  });
  test.each(["teams", "commitments", "announcements", "tasks", "meetings"] as const)("not once there are %s", (list) => {
    expect(isBrandNew({ ...alone, [list]: [{}] })).toBe(false);
  });
});

describe("nothingWaiting", () => {
  test("every count zero", () => {
    expect(nothingWaiting({ callsWaiting: 0, visitsPlanned: 0, requestsOpen: 0, approvedUnpaid: 0 })).toBe(true);
  });
  test("one thing waiting", () => {
    expect(nothingWaiting({ callsWaiting: 0, visitsPlanned: 1, requestsOpen: 0, approvedUnpaid: 0 })).toBe(false);
  });
});
