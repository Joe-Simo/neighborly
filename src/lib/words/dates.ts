import type { Language } from "./sets";

/** Browsers carry no Creole calendar words, so the app carries its own. */
const creole = {
  weekday: {
    long: ["dimanch", "lendi", "madi", "mèkredi", "jedi", "vandredi", "samdi"],
    short: ["dim", "len", "mad", "mèk", "jed", "van", "sam"],
  },
  month: {
    long: ["janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "out", "septanm", "oktòb", "novanm", "desanm"],
    short: ["jan", "fev", "mas", "avr", "me", "jen", "jiy", "out", "sep", "okt", "nov", "des"],
  },
};
const locales: Record<Language, string> = { en: "en-US", es: "es-US", ht: "fr-HT" };

/**
 * A date or time written as a reader of this language expects. Creole takes
 * its order from the French of Haiti and its day and month names from the table above.
 */
export function formatDate(language: Language, time: number, options: Intl.DateTimeFormatOptions): string {
  const format = new Intl.DateTimeFormat(locales[language], language === "ht" && options.hour ? { hour12: true, ...options } : options);
  if (language !== "ht") return format.format(time);
  const numbers = new Intl.DateTimeFormat("en-US", { timeZone: options.timeZone, weekday: "short", month: "numeric" }).formatToParts(time);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(numbers.find((part) => part.type === "weekday")?.value ?? "");
  const month = Number(numbers.find((part) => part.type === "month")?.value) - 1;
  const width = (value: Intl.DateTimeFormatOptions["weekday"] | Intl.DateTimeFormatOptions["month"]) => (value === "long" ? "long" : "short");
  return format
    .formatToParts(time)
    .map((part) =>
      part.type === "weekday" ? creole.weekday[width(options.weekday)][weekday]
      : part.type === "month" && options.month !== "numeric" && options.month !== "2-digit" ? creole.month[width(options.month)][month]
      : part.value,
    )
    .join("")
    // Servers and browsers disagree on which space sits before AM; a plain one is the same everywhere.
    .replace(/[\u202f\u00a0]/g, " ");
}

/** A calendar day stored as "yyyy-MM-dd", written out: "Dec 20, 2026". The day is the same in every time zone. */
export function formatDay(language: Language, day: string): string {
  const time = Date.parse(`${day}T12:00:00Z`);
  return Number.isFinite(time) ? formatDate(language, time, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : day;
}

/** First day to last day, or the one day when they are the same. */
export function formatDays(language: Language, start: string, end: string): string {
  return start === end ? formatDay(language, start) : `${formatDay(language, start)} – ${formatDay(language, end)}`;
}
