import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import { weekDayOf } from "./week-days";

// The way the week by team placed a commitment before: the whole days between the week's start and the moment.
const byCalendar = (weekStart: DateTime, time: number) => Math.floor(DateTime.fromMillis(time, { zone: weekStart.zone }).diff(weekStart, "days").days);

describe("weekDayOf", () => {
  // Weeks whose Sunday is a clock change in New York: spring forward (Mar 8 2026) and fall back (Nov 1 2026), and a plain week.
  for (const sunday of ["2026-03-08", "2026-11-01", "2026-11-15"])
    test(`matches the calendar every half hour of the week of ${sunday}`, () => {
      const weekStart = DateTime.fromISO(sunday, { zone: "America/New_York" }).startOf("day");
      const dayOf = weekDayOf(weekStart);
      const until = weekStart.plus({ weeks: 1 }).toMillis();
      for (let time = weekStart.toMillis(); time < until; time += 30 * 60 * 1000) expect(dayOf(time)).toBe(byCalendar(weekStart, time));
    });
});
