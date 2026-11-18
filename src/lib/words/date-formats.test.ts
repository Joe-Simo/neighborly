import { describe, expect, test } from "bun:test";
import { dateFormatter, formatDate, formatDay } from ".";

const noon = Date.parse("2026-11-18T17:30:00Z");
const zone = "America/New_York";

describe("dates come from one cached formatter per locale and options", () => {
  test("the same locale, options and zone give the same formatter", () => {
    expect(dateFormatter("en-US", { timeZone: zone, weekday: "short" })).toBe(dateFormatter("en-US", { timeZone: zone, weekday: "short" }));
    expect(dateFormatter("en-US", { timeZone: zone })).not.toBe(dateFormatter("en-US", { timeZone: "America/Chicago" }));
  });
  test("a day is written in each language", () => {
    expect(formatDay("en", "2026-11-18")).toBe("Nov 18, 2026");
    expect(formatDay("es", "2026-11-18")).toBe("18 nov 2026");
  });
  test("a date and time in the conference zone", () => {
    const options = { timeZone: zone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" } as const;
    expect(formatDate("en", noon, options)).toBe("Wednesday, November 18 at 12:30 PM");
    expect(formatDate("es", noon, options)).toBe("miércoles, 18 de noviembre, 12:30 p.m.");
  });
});
