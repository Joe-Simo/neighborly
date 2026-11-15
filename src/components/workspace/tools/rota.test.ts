import { describe, expect, test } from "bun:test";
import { DateTime } from "luxon";
import { weekLabel, weekRota, weekStart } from "./rota";

const zone = "America/New_York";
const at = (iso: string) => DateTime.fromISO(iso, { zone }).toMillis();
const shift = (id: string, start: string, who: string | null) => ({ id, title: "Help line morning", start: at(start), end: at(start) + 3 * 3600000, location: "Parish office", team: "Help line", who });

describe("the weekly rota", () => {
  test("a week runs Sunday to Saturday in the group's time zone, whatever the reader's clock says", () => {
    // 11:30 PM Saturday in New York is already Sunday in UTC; it still belongs to the week that is ending.
    const start = weekStart(at("2026-11-21T23:30"), zone);
    expect(start.toISO()).toBe("2026-11-15T00:00:00.000-05:00");
    expect(weekLabel(start)).toBe("November 15 to 21, 2026");
    expect(weekLabel(weekStart(at("2026-11-21T23:30"), zone, 2))).toBe("November 29 to December 5, 2026");
  });
  test("lists all seven days, each day's shifts in time order, and leaves out other weeks", () => {
    const days = weekRota([
      shift("c", "2026-11-18T09:00", null),
      shift("b", "2026-11-16T13:00", "Thomas Okafor"),
      shift("a", "2026-11-16T09:00", "Marisol Vega"),
      shift("late", "2026-11-22T00:00", "Renee Baptiste"),
      shift("early", "2026-11-14T21:00", "Renee Baptiste"),
    ], weekStart(at("2026-11-17T12:00"), zone));
    expect(days.map((day) => [day.label, day.shifts.map((item) => `${item.time} ${item.who ?? "open"}`)])).toEqual([
      ["Sunday, November 15", []],
      ["Monday, November 16", ["9:00 AM to 12:00 PM Marisol Vega", "1:00 PM to 4:00 PM Thomas Okafor"]],
      ["Tuesday, November 17", []],
      ["Wednesday, November 18", ["9:00 AM to 12:00 PM open"]],
      ["Thursday, November 19", []],
      ["Friday, November 20", []],
      ["Saturday, November 21", []],
    ]);
  });
  test("the week the clocks change is still seven days", () => {
    const start = weekStart(at("2026-11-01T12:00"), zone);
    expect(weekRota([shift("x", "2026-11-07T23:00", null), shift("y", "2026-11-08T00:00", null)], start).flatMap((day) => day.shifts.map((item) => item.id))).toEqual(["x"]);
  });
  test("Spanish and Creole write the week, the days and the times in their own words", () => {
    const start = weekStart(at("2026-11-17T09:00"), zone);
    expect(weekLabel(start, "es", { to: "a", through: "al" })).toBe("15 de noviembre al 21 de noviembre de 2026");
    expect(weekLabel(start, "ht", { to: "rive", through: "rive" })).toBe("15 novanm rive 21 novanm 2026");
    const [, monday] = weekRota([shift("a", "2026-11-16T09:00", null)], start, "es", { to: "a", through: "al" });
    expect([monday.label, monday.shifts[0].time]).toEqual(["Lunes, 16 de noviembre", "9:00 a.m. a 12:00 p.m."]);
    expect(weekRota([], start, "ht", { to: "rive", through: "rive" })[2].label).toBe("Madi 17 novanm");
  });
});
