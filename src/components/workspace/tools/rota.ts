import { DateTime } from "luxon";

export type RotaShift = { id: string; title: string; start: number; end: number; location: string; team: string; who: string | null };
export type RotaDay = { key: string; label: string; shifts: (RotaShift & { time: string })[] };

/** The first moment of the week holding `time`, Sunday first, in the group's own time zone. */
export function weekStart(time: number, timeZone: string, weeksAhead = 0) {
  return DateTime.fromMillis(time, { zone: timeZone, locale: "en-US" }).startOf("week", { useLocaleWeeks: true }).plus({ weeks: weeksAhead });
}
export function weekLabel(start: DateTime) {
  const end = start.plus({ days: 6 });
  return `${start.toFormat("MMMM d")} to ${end.toFormat(end.month === start.month ? "d, yyyy" : "MMMM d, yyyy")}`;
}
/** One week of shifts, all seven days in order, each day's shifts by time. An empty day stays, so the sheet can be trusted. */
export function weekRota(shifts: RotaShift[], start: DateTime): RotaDay[] {
  const days = Array.from({ length: 7 }, (_, index): RotaDay => {
    const day = start.plus({ days: index });
    return { key: day.toFormat("yyyy-MM-dd"), label: day.toFormat("cccc, MMMM d"), shifts: [] };
  });
  const from = start.toMillis(), until = start.plus({ weeks: 1 }).toMillis();
  for (const shift of shifts.filter((item) => item.start >= from && item.start < until).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))) {
    const begins = DateTime.fromMillis(shift.start, { zone: start.zone, locale: "en-US" });
    const ends = DateTime.fromMillis(shift.end, { zone: start.zone, locale: "en-US" });
    days.find((day) => day.key === begins.toFormat("yyyy-MM-dd"))?.shifts.push({ ...shift, time: `${begins.toFormat("h:mm a")} to ${ends.toFormat("h:mm a")}` });
  }
  return days;
}
