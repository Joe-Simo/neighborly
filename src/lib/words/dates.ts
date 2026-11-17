import type { Language } from "./sets";

type Names = { long: string[]; short: string[] };
/**
 * Spanish calendar words are carried here, not taken from the machine.
 * Machines disagree on Spanish order; a date must read the
 * same on the server, in every browser and on every phone.
 */
const calendars: Record<Exclude<Language, "en">, { weekday: Names; month: Names; of: string; am: string; pm: string }> = {
  es: {
    weekday: {
      long: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
      short: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    },
    month: {
      long: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
      short: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    },
    of: " de ",
    am: "a.m.",
    pm: "p.m.",
  },
};

/**
 * One formatter for each way of writing a date, made once. Making one is slow, and a room writes hundreds of dates
 * each time it is drawn (every shift's year, every row's day), so a new one for every date held up the page.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(options);
  let made = formatters.get(key);
  if (!made) formatters.set(key, (made = new Intl.DateTimeFormat("en-US", options)));
  return made;
}

/** The plain numbers of a moment in a time zone. Only digits and English day codes are read, which every machine writes alike. */
function numbers(time: number, timeZone: string | undefined) {
  const parts = formatter({ timeZone, weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).formatToParts(time);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(read("weekday")),
    year: Number(read("year")), month: Number(read("month")) - 1, day: Number(read("day")),
    hour: Number(read("hour")) % 24, minute: read("minute").padStart(2, "0"),
  };
}

/** dateStyle and timeStyle, said as the single fields they stand for. */
function fields(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  const date: Intl.DateTimeFormatOptions =
    options.dateStyle === "full" ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    : options.dateStyle === "long" ? { month: "long", day: "numeric", year: "numeric" }
    : options.dateStyle === "medium" ? { month: "short", day: "numeric", year: "numeric" }
    : options.dateStyle === "short" ? { month: "numeric", day: "numeric", year: "numeric" }
    : {};
  return { ...options, ...date, ...(options.timeStyle ? { hour: "numeric", minute: "2-digit" } : {}) };
}

/**
 * A date or time written as a reader of this language expects. English is the
 * machine's own en-US, which is the same everywhere and is what the screens have
 * always shown. Spanish is put together here: day before month,
 * a twelve-hour clock, and the words from the tables above.
 */
export function formatDate(language: Language, time: number, options: Intl.DateTimeFormatOptions): string {
  if (language === "en") return formatter(options).format(time);
  const calendar = calendars[language];
  const wanted = fields(options);
  const at = numbers(time, options.timeZone);
  const written = wanted.month === "long" || wanted.month === "short" || wanted.month === "narrow";
  const width = (value: string | undefined) => (value === "long" ? "long" : "short");
  let date = "";
  if (wanted.month && !written) {
    date = [wanted.day && at.day, at.month + 1, wanted.year && at.year].filter(Boolean).join("/");
  } else {
    const of = wanted.month === "long" ? calendar.of : " ";
    date = [wanted.day && String(at.day), wanted.month && calendar.month[width(wanted.month)][at.month]].filter(Boolean).join(of);
    if (wanted.year) date = date ? `${date}${wanted.month ? of : " "}${at.year}` : String(at.year);
  }
  if (wanted.weekday) {
    const weekday = calendar.weekday[width(wanted.weekday)][at.weekday];
    date = date ? `${weekday}${language === "es" ? "," : ""} ${date}` : weekday;
  }
  let clock = "";
  if (wanted.hour) {
    const hour = at.hour % 12 || 12;
    clock = `${hour}${wanted.minute ? `:${at.minute}` : ""} ${at.hour < 12 ? calendar.am : calendar.pm}`;
  }
  return [date, clock].filter(Boolean).join(", ");
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
