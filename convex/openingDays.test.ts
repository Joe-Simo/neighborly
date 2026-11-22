import { describe, expect, test } from "vitest";
import { groupOpenings } from "./openingDays";

const at = (iso: string) => Date.parse(iso);

describe("groupOpenings", () => {
  test("one person's repeats on one day fold into one row with the count and the last time", () => {
    const openings = Array.from({ length: 21 }, (_, i) => ({ who: "owner", at: at("2026-11-21T15:20:00Z") - i * 60_000 }));
    expect(groupOpenings(openings, "America/Chicago")).toEqual([{ who: "owner", count: 21, at: at("2026-11-21T15:20:00Z") }]);
  });

  test("days split in the conference's time zone, and people stay apart, newest first", () => {
    const rows = groupOpenings(
      [
        { who: "a", at: at("2026-11-22T06:30:00Z") }, // Nov 22, 12:30 AM in Chicago
        { who: "b", at: at("2026-11-22T06:00:00Z") },
        { who: "a", at: at("2026-11-22T05:30:00Z") }, // Nov 21, 11:30 PM in Chicago
        { who: "a", at: at("2026-11-21T20:00:00Z") },
      ],
      "America/Chicago",
    );
    expect(rows).toEqual([
      { who: "a", count: 1, at: at("2026-11-22T06:30:00Z") },
      { who: "b", count: 1, at: at("2026-11-22T06:00:00Z") },
      { who: "a", count: 2, at: at("2026-11-22T05:30:00Z") },
    ]);
  });
});
