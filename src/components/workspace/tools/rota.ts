import { DateTime } from "luxon";
import { formatDate, type Language, type Words } from "@/lib/words";

export type RotaShift = { id: string; title: string; start: number; end: number; location: string; team: string; who: string | null };
export type RotaDay = { key: string; label: string; shifts: (RotaShift & { time: string })[] };

/** The first moment of the week holding `time`, Sunday first, in the group's own time zone. */
export function weekStart(time: number, timeZone: string, weeksAhead = 0) {
  return DateTime.fromMillis(time, { zone: timeZone, locale: "en-US" }).startOf("week", { useLocaleWeeks: true }).plus({ weeks: weeksAhead });
}
/** The words that join two times of day and the two ends of a week. English keeps its shorter week line. */
type Joins = Pick<Words["rota"], "to" | "through">;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function weekLabel(start: DateTime, language: Language = "en", joins: Joins = { to: "to", through: "to" }) {
  const end = start.plus({ days: 6 });
  if (language !== "en") {
    const day = (at: DateTime, year: boolean) => formatDate(language, at.toMillis(), { timeZone: start.zoneName ?? undefined, month: "long", day: "numeric", year: year ? "numeric" : undefined });
    // Within one month the month is written once: "15 al 21 de noviembre de 2026".
    return `${end.month === start.month ? start.day : day(start, false)} ${joins.through} ${day(end, true)}`;
  }
  return `${start.toFormat("MMMM d")} to ${end.toFormat(end.month === start.month ? "d, yyyy" : "MMMM d, yyyy")}`;
}
/** One week of shifts, all seven days in order, each day's shifts by time. An empty day stays, so the sheet can be trusted. */
export function weekRota(shifts: RotaShift[], start: DateTime, language: Language = "en", joins: Joins = { to: "to", through: "to" }): RotaDay[] {
  const timeZone = start.zoneName ?? undefined;
  const clock = (at: DateTime) => (language === "en" ? at.toFormat("h:mm a") : formatDate(language, at.toMillis(), { timeZone, hour: "numeric", minute: "2-digit" }));
  const days = Array.from({ length: 7 }, (_, index): RotaDay => {
    const day = start.plus({ days: index });
    return { key: day.toFormat("yyyy-MM-dd"), label: language === "en" ? day.toFormat("cccc, MMMM d") : capital(formatDate(language, day.toMillis() + 12 * 3_600_000, { timeZone, weekday: "long", month: "long", day: "numeric" })), shifts: [] };
  });
  const from = start.toMillis(), until = start.plus({ weeks: 1 }).toMillis();
  for (const shift of shifts.filter((item) => item.start >= from && item.start < until).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))) {
    const begins = DateTime.fromMillis(shift.start, { zone: start.zone, locale: "en-US" });
    const ends = DateTime.fromMillis(shift.end, { zone: start.zone, locale: "en-US" });
    days.find((day) => day.key === begins.toFormat("yyyy-MM-dd"))?.shifts.push({ ...shift, time: `${clock(begins)} ${joins.to} ${clock(ends)}` });
  }
  return days;
}
