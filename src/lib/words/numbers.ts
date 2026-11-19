import type { Language } from "./sets";

/**
 * How each language writes a count and an amount of money. Spanish is written as in the United States (es-US),
 * where the app's neighbors read it: "27,400" and "$52,435.00", grouped the same at four digits as at five
 * (es-ES would write "1589" but "27.400"). English is en-US.
 */
export const numberLocales: Record<Language, string> = { en: "en-US", es: "es-US" };

// One formatter for each language and way of writing, made once: making one is slow and a room writes many.
const made = new Map<string, Intl.NumberFormat>();
function formatter(language: Language, options: Intl.NumberFormatOptions) {
  const key = `${language}:${JSON.stringify(options)}`;
  let format = made.get(key);
  if (!format) made.set(key, (format = new Intl.NumberFormat(numberLocales[language], options)));
  return format;
}

/** A count as the reader writes it: "27,400", "177.5". */
export const formatCount = (value: number, language: Language = "en") =>
  formatter(language, { maximumFractionDigits: 1 }).format(value);

/** Dollars as the reader writes them: "$52,435.00", or "$52,435" with whole set. */
export const formatMoney = (value: number, language: Language = "en", whole = false) =>
  formatter(language, whole ? { style: "currency", currency: "USD", maximumFractionDigits: 0 } : { style: "currency", currency: "USD" }).format(value);

/** A writer of counts for one language, for a words table to call as n(count). */
export const counter = (language: Language) => (value: number) => formatCount(value, language);

// One list writer per language, made once, like the number writers above.
const lists = new Map<Language, Intl.ListFormat>();
/** Items said as a list in the reader's language: "Parish collection and Donation", "A, B y C". */
export function formatList(items: readonly string[], language: Language = "en") {
  let format = lists.get(language);
  if (!format) lists.set(language, (format = new Intl.ListFormat(numberLocales[language], { type: "conjunction" })));
  return format.format(items);
}
