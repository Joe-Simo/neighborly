import { DateTime, IANAZone } from "luxon";

const localPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const offsetPattern = /(?:Z|[+-]\d{2}:\d{2})$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validZone(timeZone: string) {
  if (!IANAZone.isValidZone(timeZone)) throw new Error("Choose a valid time zone.");
}

/** Interpret a form's wall clock in the church's zone, never the browser's zone. */
export function parseScheduledTime(value: string, timeZone: string): number {
  validZone(timeZone);
  const explicitOffset = offsetPattern.test(value);
  if (!explicitOffset && !localPattern.test(value)) {
    throw new Error("Enter a complete date and time.");
  }
  const parsed = DateTime.fromISO(value, { zone: timeZone, setZone: explicitOffset });
  if (!parsed.isValid) throw new Error("Enter a valid date and time.");
  if (!explicitOffset) {
    const format = value.length === 19 ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd'T'HH:mm";
    if (parsed.toFormat(format) !== value) {
      throw new Error("That time does not exist because the clocks change. Choose another time.");
    }
    if (parsed.getPossibleOffsets().length > 1) {
      throw new Error("That time occurs twice because the clocks change. Choose another time or specify its UTC offset.");
    }
  }
  return parsed.toMillis();
}

export function parseCalendarDate(value: string, timeZone: string): DateTime {
  validZone(timeZone);
  const parsed = DateTime.fromISO(value, { zone: timeZone });
  if (!datePattern.test(value) || !parsed.isValid || parsed.toISODate() !== value) {
    throw new Error("Choose a valid calendar date.");
  }
  return parsed.startOf("day");
}

export function overlapsTimeOff(
  start: number,
  end: number,
  from: string,
  through: string,
  timeZone: string,
): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("The end must be after the start.");
  }
  const first = parseCalendarDate(from, timeZone);
  const last = parseCalendarDate(through, timeZone);
  if (last < first) throw new Error("The last day must be on or after the first day.");
  return start < last.plus({ days: 1 }).toMillis() && end > first.toMillis();
}

export type ScheduleInput = {
  start: string;
  end: string;
  timeZone: string;
  intervalWeeks?: number;
  count?: number;
};

/** Materialize bounded occurrences, preserving local wall time across DST. */
export function expandWeeklySchedule({ start, end, timeZone, intervalWeeks = 1, count = 1 }: ScheduleInput) {
  if (!Number.isInteger(count) || count < 1 || count > 52 ||
    !Number.isInteger(intervalWeeks) || intervalWeeks < 1 || intervalWeeks > 52 ||
    (count - 1) * intervalWeeks > 52) {
    throw new Error("Choose up to 52 occurrences within one year.");
  }
  const initialStart = DateTime.fromMillis(parseScheduledTime(start, timeZone), { zone: timeZone });
  const initialEnd = DateTime.fromMillis(parseScheduledTime(end, timeZone), { zone: timeZone });
  if (initialEnd <= initialStart) throw new Error("The end must be after the start.");
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { start: initialStart.toMillis(), end: initialEnd.toMillis() };
    const weeks = index * intervalWeeks;
    // Add weeks to the date separately: adding to the timestamp can silently
    // normalize a nonexistent DST clock time before it is validated.
    const startDate = initialStart.startOf("day").plus({ weeks }).toISODate();
    const endDate = initialEnd.startOf("day").plus({ weeks }).toISODate();
    const occurrenceStart = parseScheduledTime(`${startDate}T${initialStart.toFormat("HH:mm:ss")}`, timeZone);
    const occurrenceEnd = parseScheduledTime(`${endDate}T${initialEnd.toFormat("HH:mm:ss")}`, timeZone);
    if (occurrenceEnd <= occurrenceStart) throw new Error("The end must be after the start.");
    return { start: occurrenceStart, end: occurrenceEnd };
  });
}
