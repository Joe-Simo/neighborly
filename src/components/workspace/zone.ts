import { dateFormatter } from "@/lib/words/dates";
/** A time zone said as people say it: "America/New_York" is "Eastern time". */
export function zoneName(timeZone: string, language: "en" | "es" = "en") {
  const name = dateFormatter(language === "es" ? "es-US" : "en-US", { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(0)
    .find((part) => part.type === "timeZoneName")?.value;
  return name ? name.replace(/ Time$/, " time") : timeZone;
}
