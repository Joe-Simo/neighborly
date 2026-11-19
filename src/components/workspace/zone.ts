import { dateFormatter } from "@/lib/words/dates";
import { whenIdle } from "@/lib/idle";

/**
 * Asking the browser for a zone's spoken name loads its names for every zone (tens of milliseconds on a phone), so each
 * answer is kept, and the conference's own is asked once the page is idle (sayZoneLater), never in the room's first frames.
 */
const said = new Map<string, string>();
/** A time zone said as people say it: "America/New_York" is "Eastern time". */
export function zoneName(timeZone: string, language: "en" | "es" = "en") {
  const key = `${language}:${timeZone}`;
  const known = said.get(key);
  if (known !== undefined) return known;
  const name = dateFormatter(language === "es" ? "es-US" : "en-US", { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(0)
    .find((part) => part.type === "timeZoneName")?.value;
  const spoken = name ? name.replace(/ Time$/, " time") : timeZone;
  said.set(key, spoken);
  return spoken;
}

/** Works out the zone's name once the page is idle, so the sheet that says it later opens without the wait. */
export function sayZoneLater(timeZone: string, language: "en" | "es" = "en") {
  return whenIdle(() => zoneName(timeZone, language), 2000);
}

/** The zone's name said in a sentence, worked out only when it is drawn (a sheet's line is drawn only while the sheet is open). */
export function ZoneSaid({ timeZone, language, say }: { timeZone: string; language: "en" | "es"; say: (zone: string) => string }) {
  return say(zoneName(timeZone, language));
}
