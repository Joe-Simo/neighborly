import { describe, expect, test } from "bun:test";
import { words } from "@/lib/words";
import { mondayOf, weekLines } from "./week-note";

const none = { callsWaiting: 0, callsFirstByAssistant: 0, callsFirstByRules: 0, callsFirstByPerson: 0, oldestWaitingDays: 0, visitsPlanned: 0, requestsOpen: 0, approvedUnpaid: 0, approvedUnpaidCents: 0, openPlaces: 0, away: 0 };
const texts = (...args: Parameters<typeof weekLines>) => weekLines(...args).map((line) => line.parts.map((part) => part.text).join(" "));

describe("the Monday note", () => {
  test("a quiet week has no lines", () => {
    expect(weekLines(words("en").monday, none)).toEqual([]);
  });

  test("urgency and waiting are said only alongside the calls they describe", () => {
    expect(weekLines(words("en").monday, { ...none, callsFirstByAssistant: 2, oldestWaitingDays: 4 })).toEqual([]);
    expect(weekLines(words("en").monday, { ...none, callsWaiting: 4, callsFirstByAssistant: 1, callsFirstByRules: 1, callsFirstByPerson: 2, oldestWaitingDays: 4, away: 2 })).toEqual([
      { area: "help-line", parts: [{ text: "4 calls are waiting to be returned." }, { text: "1 was put first by the assistant from its note.", assistant: true }, { text: "1 was put first from its note." }, { text: "2 were put first by one of you." }, { text: "The oldest has waited 4 days." }], brief: "4 calls to return" },
      { area: "time-off", parts: [{ text: "2 volunteers are away this week." }], brief: "2 volunteers away" },
    ]);
  });

  test("never more than four lines, the most pressing kept", () => {
    const lines = weekLines(words("en").monday, { ...none, callsWaiting: 1, requestsOpen: 1, approvedUnpaid: 1, visitsPlanned: 1, openPlaces: 1, away: 1 });
    expect(lines.map((line) => line.area)).toEqual(["help-line", "neighbors", "treasury", "visits"]);
  });

  test("the St. Vincent de Paul word set and Spanish carry through", () => {
    expect(texts(words("en", "vincentian").monday, { ...none, visitsPlanned: 1 })).toEqual(["1 home visit is planned."]);
    expect(texts(words("es", "vincentian").monday, { ...none, visitsPlanned: 2 })).toEqual(["Hay 2 visitas domiciliarias planeadas."]);
  });

  test("the week opens on the group's own Monday", () => {
    const format = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(time);
    expect(format(mondayOf(Date.parse("2026-11-15T14:00:00Z"), "America/New_York"))).toBe("2026-11-09");
    expect(format(mondayOf(Date.parse("2026-11-17T03:30:00Z"), "America/New_York"))).toBe("2026-11-16");
  });
});
