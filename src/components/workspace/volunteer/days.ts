import { formatDate, type Words } from "@/lib/words";

/** The one date pattern for whole days: "Thursday, November 19 to Saturday, November 21". The year is written only when it is not this one. */
export function readDays(words: Words, start: string, end: string) {
  return readDaysParts(words, start, end).join(" ");
}

/** The same words in their two halves, the first day and "to" the last, for a heading that breaks between them. */
export function readDaysParts(words: Words, start: string, end: string): string[] {
  const read = (day: string) => {
    const time = Date.parse(`${day}T12:00:00Z`);
    if (!Number.isFinite(time)) return day;
    return formatDate(words.locale, time, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: day.startsWith(String(new Date().getFullYear())) ? undefined : "numeric" });
  };
  const first = read(start);
  const parts = start === end ? [first] : [first, `${words.rota.through} ${read(end)}`];
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts;
}
