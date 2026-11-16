import { formatDate, type Words } from "@/lib/words";

/** The one date pattern for whole days: "Thursday, November 19 to Saturday, November 21". The year is written only when it is not this one. */
export function readDays(words: Words, start: string, end: string) {
  const read = (day: string) => {
    const time = Date.parse(`${day}T12:00:00Z`);
    if (!Number.isFinite(time)) return day;
    return formatDate(words.locale, time, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: day.startsWith(String(new Date().getFullYear())) ? undefined : "numeric" });
  };
  const whole = start === end ? read(start) : `${read(start)} ${words.rota.through} ${read(end)}`;
  return whole.charAt(0).toUpperCase() + whole.slice(1);
}
