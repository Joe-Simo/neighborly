import type { DateTime } from "luxon";

/**
 * The day of the week (0 for the week's first day) that a moment falls on, in the zone `weekStart` is in. The seven day
 * starts are worked out once, so a room can place every commitment without asking the calendar for each one.
 */
export function weekDayOf(weekStart: DateTime) {
  const dayStarts = Array.from({ length: 7 }, (_, day) => weekStart.plus({ days: day }).toMillis());
  // A count rather than findLastIndex, which iOS 15.0-15.3 Safari does not have. The starts ascend, so it is the same.
  return (time: number) => dayStarts.filter((start) => time >= start).length - 1;
}
