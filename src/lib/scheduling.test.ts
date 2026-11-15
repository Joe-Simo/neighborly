import { describe, expect, test } from "bun:test";
import { expandWeeklySchedule, overlapsTimeOff, parseCalendarDate, parseScheduledTime } from "./scheduling";

describe("church-local scheduling", () => {
  test("interprets a wall clock in the selected zone", () => {
    expect(parseScheduledTime("2026-11-22T09:30", "America/New_York")).toBe(Date.parse("2026-11-22T14:30:00Z"));
    expect(parseScheduledTime("2026-11-22T09:30", "Asia/Tokyo")).toBe(Date.parse("2026-11-22T00:30:00Z"));
  });
  test("rejects nonexistent and ambiguous daylight-saving clock times", () => {
    expect(() => parseScheduledTime("2026-03-08T02:30", "America/New_York")).toThrow("does not exist");
    expect(() => parseScheduledTime("2026-11-01T01:30", "America/New_York")).toThrow("occurs twice");
    expect(parseScheduledTime("2026-11-01T01:30-05:00", "America/New_York")).toBe(Date.parse("2026-11-01T06:30:00Z"));
    expect(expandWeeklySchedule({ start: "2026-11-01T01:30-05:00", end: "2026-11-01T02:30-05:00", timeZone: "America/New_York" })[0].start).toBe(Date.parse("2026-11-01T06:30:00Z"));
  });
  test("weekly repeats preserve local time across the spring change", () => {
    const events = expandWeeklySchedule({ start: "2026-03-01T09:30", end: "2026-03-01T11:00", timeZone: "America/New_York", count: 3 });
    expect(events.map(event => new Date(event.start).toISOString())).toEqual(["2026-03-01T14:30:00.000Z", "2026-03-08T13:30:00.000Z", "2026-03-15T13:30:00.000Z"]);
  });
  test("a later occurrence cannot silently shift through a DST gap", () => {
    expect(() => expandWeeklySchedule({ start: "2026-03-01T02:30", end: "2026-03-01T04:00", timeZone: "America/New_York", count: 2 })).toThrow("does not exist");
  });
  test("every-other-week and overnight occurrences remain explicit", () => {
    const events = expandWeeklySchedule({ start: "2026-11-07T23:30", end: "2026-11-08T00:30", timeZone: "UTC", count: 2, intervalWeeks: 2 });
    expect(events[1]).toEqual({ start: Date.parse("2026-11-21T23:30Z"), end: Date.parse("2026-11-22T00:30Z") });
  });
  test("time off includes its last local day and uses exclusive event ends", () => {
    const midnight = Date.parse("2026-11-22T05:00Z");
    expect(overlapsTimeOff(midnight - 3600000, midnight, "2026-11-22", "2026-11-22", "America/New_York")).toBe(false);
    expect(overlapsTimeOff(midnight, midnight + 3600000, "2026-11-22", "2026-11-22", "America/New_York")).toBe(true);
    expect(overlapsTimeOff(Date.parse("2026-11-23T04:30Z"), Date.parse("2026-11-23T06:00Z"), "2026-11-22", "2026-11-22", "America/New_York")).toBe(true);
  });
  test("calendar errors and unbounded recurrence fail clearly", () => {
    expect(() => parseCalendarDate("2026-02-30", "UTC")).toThrow();
    expect(() => parseScheduledTime("2026-11-22T09:30", "Invalid/Place")).toThrow();
    expect(() => expandWeeklySchedule({ start: "2026-11-22T09:30", end: "2026-11-22T09:00", timeZone: "UTC" })).toThrow();
    expect(() => expandWeeklySchedule({ start: "2026-11-22T09:30", end: "2026-11-22T11:00", timeZone: "UTC", count: 53 })).toThrow();
  });
});
