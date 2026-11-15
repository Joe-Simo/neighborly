import { describe, expect, test } from "bun:test";
import { words } from "@/lib/words";
import { weekLines } from "./week-note";

const none = { callsWaiting: 0, callsUrgent: 0, oldestWaitingDays: 0, visitsPlanned: 0, requestsOpen: 0, approvedUnpaid: 0, approvedUnpaidCents: 0, openPlaces: 0, away: 0 };

describe("the Monday note", () => {
  test("a quiet week has no lines", () => {
    expect(weekLines(words("en").monday, none)).toEqual([]);
  });

  test("urgency and waiting are said only alongside the calls they describe", () => {
    expect(weekLines(words("en").monday, { ...none, callsUrgent: 2, oldestWaitingDays: 4 })).toEqual([]);
    expect(weekLines(words("en").monday, { ...none, callsWaiting: 3, callsUrgent: 1, oldestWaitingDays: 4, away: 2 })).toEqual([
      "3 calls are waiting to be returned. 1 of them looks urgent. The oldest has waited 4 days.",
      "2 volunteers are away this week.",
    ]);
  });

  test("the St. Vincent de Paul word set and Spanish carry through", () => {
    expect(weekLines(words("en", "vincentian").monday, { ...none, visitsPlanned: 1 })).toEqual(["1 Home Visit is planned."]);
    expect(weekLines(words("es").monday, { ...none, callsWaiting: 1 })).toEqual([words("es").monday.calls(1)]);
  });
});
