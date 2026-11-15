import { describe, expect, test } from "bun:test";
import { formatDate, formatDay, formatDays } from "./dates";

const tuesday = Date.parse("2026-11-17T14:00:00Z");
const shape = { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" } as const;

describe("dates in each language", () => {
  test("English reads as it always has", () => {
    expect(formatDate("en", tuesday, shape)).toBe(new Intl.DateTimeFormat("en", shape).format(tuesday));
    expect(formatDate("en", tuesday, shape)).toBe("Tue, Nov 17");
  });

  test("Spanish uses its own words and a twelve-hour clock", () => {
    expect(formatDate("es", tuesday, shape)).toMatch(/^mar, 17 (de )?nov$/);
    expect(formatDate("es", tuesday, { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })).toMatch(/^9:00\s?a\.\s?m\.$/);
  });

  test("Creole uses Creole day and month names, never French or English", () => {
    expect(formatDate("ht", tuesday, shape)).toBe("mad 17 nov");
    expect(formatDate("ht", tuesday, { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" })).toBe("madi 17 novanm");
    expect(formatDate("ht", Date.parse("2026-08-02T16:00:00Z"), { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" })).toBe("dimanch 2 out");
    // The day belongs to the group's time zone, not to the server's.
    expect(formatDate("ht", Date.parse("2026-11-18T03:30:00Z"), shape)).toBe("mad 17 nov");
  });

  test("a stored day is written out the same in every time zone", () => {
    expect(formatDay("en", "2026-12-20")).toBe("Dec 20, 2026");
    expect(formatDay("es", "2026-12-20")).toMatch(/^20 (de )?dic (de )?2026$/);
    expect(formatDay("ht", "2027-01-04")).toBe("4 jan 2027");
    expect(formatDays("en", "2026-12-20", "2027-01-04")).toBe("Dec 20, 2026 – Jan 4, 2027");
    expect(formatDays("en", "2026-12-20", "2026-12-20")).toBe("Dec 20, 2026");
    expect(formatDay("en", "not a day")).toBe("not a day");
  });
});
