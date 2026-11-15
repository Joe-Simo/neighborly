export type DraftFields = {
  teamName: string;
  firstDate: string;
  time: string;
  recurrence: string;
  peopleCount: string;
  timeZone: string;
  role: string;
  participants: string;
};

export type DraftErrors = Partial<Record<keyof DraftFields, string>>;

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number(match[1]) === 0) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function minutes(
  value: string,
): { value: number; format: "24h" | "12h" } | null {
  const twentyFour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (twentyFour) {
    return {
      value: Number(twentyFour[1]) * 60 + Number(twentyFour[2]),
      format: "24h",
    };
  }
  const twelve = /^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])\.?m\.?$/i.exec(
    value,
  );
  if (!twelve) return null;
  const hour =
    (Number(twelve[1]) % 12) + (twelve[3].toLowerCase() === "p" ? 12 : 0);
  return { value: hour * 60 + Number(twelve[2] ?? 0), format: "12h" };
}

function timeError(value: string): string | undefined {
  const endpoints = value
    .replace(/^from\s+/i, "")
    .split(/\s*(?:–|-|\bto\b)\s*/i);
  if (endpoints.length !== 2) {
    return "Enter a time range, such as 09:30–11:00 or 9:30 AM to 11 AM.";
  }
  const start = minutes(endpoints[0]);
  const end = minutes(endpoints[1]);
  if (!start || !end || start.format !== end.format) {
    return "Use AM/PM on both times, or two-digit 24-hour times such as 09:30–11:00.";
  }
  if (end.value <= start.value) {
    return "The end must be after the start on the same day. Review the times before continuing.";
  }
}

/** Validates only the editable local draft; this does not schedule or authorize anything. */
export function validateDraft(fields: DraftFields): DraftErrors {
  const errors: DraftErrors = {};
  const required: Record<keyof DraftFields, string> = {
    teamName: "Enter a team name.",
    firstDate: "Choose the first date.",
    time: "Enter the start and end time.",
    recurrence: "Describe when this repeats, or enter Once.",
    peopleCount: "Enter how many people are needed.",
    timeZone: "Enter a named time zone, such as America/New_York.",
    role: "Describe the responsibility before asking someone to accept it.",
    participants: "Enter the people you want to discuss the draft with.",
  };
  for (const field of Object.keys(required) as (keyof DraftFields)[]) {
    if (!fields[field].trim()) errors[field] = required[field];
  }
  if (!errors.firstDate && !isCalendarDate(fields.firstDate.trim())) {
    errors.firstDate = "Choose a real calendar date in YYYY-MM-DD format.";
  }
  if (!errors.time) {
    const message = timeError(fields.time.trim());
    if (message) errors.time = message;
  }
  if (
    !errors.peopleCount &&
    (!/^\d+$/.test(fields.peopleCount.trim()) ||
      Number(fields.peopleCount) < 1 ||
      Number(fields.peopleCount) > 100)
  ) {
    errors.peopleCount = "Enter a whole number from 1 to 100.";
  }
  if (!errors.timeZone) {
    const zone = fields.timeZone.trim();
    try {
      if (
        zone !== "UTC" &&
        !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(zone)
      ) {
        throw new RangeError("A named zone is required");
      }
      new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
    } catch {
      errors.timeZone =
        "Use a valid named time zone, such as America/New_York, or UTC.";
    }
  }
  return errors;
}
