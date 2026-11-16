import { describe, expect, test } from "bun:test";
import { formatDate, formatDay, formatDays } from "./dates";

const tuesday = Date.parse("2026-11-17T14:00:00Z");
const zone = "America/New_York";
const shape = { timeZone: zone, weekday: "short", month: "short", day: "numeric" } as const;
const clock = { timeZone: zone, hour: "numeric", minute: "2-digit" } as const;

describe("dates in each language", () => {
  test("English reads as it always has", () => {
    expect(formatDate("en", tuesday, shape)).toBe(new Intl.DateTimeFormat("en", shape).format(tuesday));
    expect(formatDate("en", tuesday, shape)).toBe("Tue, Nov 17");
  });

  test("Spanish is written from the app's own words, day before month, on any machine", () => {
    expect(formatDate("es", tuesday, shape)).toBe("mar, 17 nov");
    expect(formatDate("es", tuesday, { timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric" })).toBe("martes, 17 de noviembre de 2026");
    expect(formatDate("es", tuesday, clock)).toBe("9:00 a.m.");
    expect(formatDate("es", Date.parse("2026-11-17T17:05:00Z"), clock)).toBe("12:05 p.m.");
    expect(formatDate("es", Date.parse("2026-11-17T05:30:00Z"), clock)).toBe("12:30 a.m.");
  });

  test("the single pieces a row is built from", () => {
    expect(formatDate("es", tuesday, { timeZone: zone, month: "short" })).toBe("nov");
    expect(formatDate("es", tuesday, { timeZone: zone, day: "numeric" })).toBe("17");
    expect(formatDate("es", tuesday, { timeZone: zone, weekday: "short" })).toBe("mar");
    expect(formatDate("es", tuesday, { timeZone: zone, dateStyle: "medium" })).toBe("17 nov 2026");
    expect(formatDate("es", tuesday, { timeZone: zone, dateStyle: "short" })).toBe("17/11/2026");
    expect(formatDate("es", tuesday, { timeZone: zone, month: "long", year: "numeric" })).toBe("noviembre de 2026");
  });

  test("a stored day is written out the same in every time zone", () => {
    expect(formatDay("en", "2026-12-20")).toBe("Dec 20, 2026");
    expect(formatDay("es", "2026-12-20")).toBe("20 dic 2026");
    expect(formatDays("en", "2026-12-20", "2027-01-04")).toBe("Dec 20, 2026 – Jan 4, 2027");
    expect(formatDays("es", "2026-12-20", "2027-01-04")).toBe("20 dic 2026 – 4 ene 2027");
    expect(formatDays("en", "2026-12-20", "2026-12-20")).toBe("Dec 20, 2026");
    expect(formatDay("en", "not a day")).toBe("not a day");
  });
});
