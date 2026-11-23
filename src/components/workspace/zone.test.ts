import { describe, expect, test } from "bun:test";
import { conferenceDay } from "./zone";

describe("the conference's day", () => {
  test("is the day in the conference's zone, not the machine's", () => {
    const lateEvening = Date.UTC(2026, 10, 23, 3, 0); // 9 p.m. on the 22nd in Chicago, already the 23rd in UTC
    expect(conferenceDay(lateEvening, "America/Chicago")).toBe("2026-11-22");
    expect(conferenceDay(lateEvening, "UTC")).toBe("2026-11-23");
    expect(conferenceDay(Date.UTC(2026, 0, 5, 12), "Pacific/Auckland")).toBe("2026-01-06");
  });
});
