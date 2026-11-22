import { DateTime } from "luxon";

/** One person's openings of a record on one day in the conference's time zone. */
export type OpeningDay<Who extends string> = { who: Who; count: number; at: number };

/** Folds openings into one row per person per day, newest last opening first, so twenty openings by one person read as one line. */
export function groupOpenings<Who extends string>(openings: { who: Who; at: number }[], timeZone: string): OpeningDay<Who>[] {
  const days = new Map<string, OpeningDay<Who>>();
  for (const opening of openings) {
    const key = `${opening.who}|${DateTime.fromMillis(opening.at, { zone: timeZone }).toISODate()}`;
    const day = days.get(key);
    if (day) {
      day.count += 1;
      day.at = Math.max(day.at, opening.at);
    } else days.set(key, { who: opening.who, count: 1, at: opening.at });
  }
  return [...days.values()].sort((a, b) => b.at - a.at);
}
