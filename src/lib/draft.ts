export interface TeamDraft {
  teamName: string;
  recurrence: string;
  peopleCount: string;
  time: string;
  notes: string[];
}

const numberWords: Readonly<Record<string, string>> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};
const clockPattern = "(?:[01]?\\d|2[0-3])(?::[0-5]\\d)?(?:\\s*[ap]\\.?m\\.?)?";
const rangePattern = new RegExp(
  `^from\\s+(${clockPattern})\\s+to\\s+(${clockPattern})$`,
  "i",
);
const countPattern = /^(?:(?:we|our team)\s+(?:need|needs|require|requires)\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+people(?:\s+(from\s+.+))?$/i;
const recurrencePattern = /^(?:(?:our\s+([\p{L}][\p{L}\p{N} '&-]{0,60}?\bteam)|we)\s+(?:serves|serve|meets|meet)\s+)?(every\s+(?:other\s+)?Sunday)$/iu;
const teamReferencePattern = /\b(?:our|the|a|an)\s+((?:[\p{L}][\p{L}\p{N}'&-]*\s+){1,4}team)\b/giu;
/** Words that sit before "team" without naming it: "a new team" has no name yet. */
const unnamed = /^(?:new|small|big|second|third|another|other|whole|same|good|great|volunteer)\s+team$/i;
/** A clause that asks, denies or hedges states nothing. */
const unsure = /\?|n't\b|\b(?:not|no|never|if|maybe|perhaps|might|may|could|should|would|probably|possibly|unless|or|either)\b/i;
const named = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** Recognize only complete, affirmative clauses in the small supported grammar. */
function clauses(description: string): string[] {
  return description
    .replace(/\b([ap])\.\s*m\.?/gi, "$1m")
    // Keep question marks on their clauses so a question cannot match the
    // affirmative grammar and be presented as a confirmed requirement.
    .split(/(?<=\?)|[.!;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueValue(values: string[]): string {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : "";
}

function clock(
  value: string,
): {
  hour: number;
  minute: number;
  meridiem: string | undefined;
  explicit24h: boolean;
} | null {
  const match = /^(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?$/i.exec(value);
  if (match) {
    const hour = Number(match[1]);
    if (hour < 1 || hour > 12) return null;
    return {
      hour: (hour % 12) + (match[3].toLowerCase() === "p" ? 12 : 0),
      minute: Number(match[2] ?? 0),
      meridiem: match[3],
      explicit24h: false,
    };
  }
  const plain = /^(\d{1,2})(?::([0-5]\d))?$/.exec(value);
  if (!plain || Number(plain[1]) > 23) return null;
  const hour = Number(plain[1]);
  return {
    hour,
    minute: Number(plain[2] ?? 0),
    meridiem: undefined,
    explicit24h: hour > 12 || hour === 0 || /^0\d:/.test(value),
  };
}
function formatClock(value: { hour: number; minute: number }): string {
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
}

/** Copies narrow, explicit facts only; it does not infer availability or acceptance. */
export function prepareDraft(description: string): TeamDraft {
  const draft: TeamDraft = {
    teamName: "",
    recurrence: "",
    peopleCount: "",
    time: "",
    notes: [],
  };
  const parts = clauses(description);
  const teamNames: string[] = [];
  let uncertainTeam = false;
  const recurrences: string[] = [];
  const counts: string[] = [];
  const ranges: string[] = [];
  let uncertainRecurrence = false;
  let uncertainCount = false;
  let uncertainTime = false;
  for (const part of parts) {
    const recurrence = recurrencePattern.exec(part);
    const referencedTeams = [...part.matchAll(teamReferencePattern)].map((match) => match[1]).filter((name) => !unnamed.test(name));
    // "Our food pantry team sorts donations" names the team as plainly as "Our welcome team serves every Sunday".
    if (recurrence?.[1]) teamNames.push(named(recurrence[1]));
    else if (referencedTeams.length && unsure.test(part)) uncertainTeam = true;
    else teamNames.push(...referencedTeams.map(named));
    if (recurrence)
      recurrences.push(
        /\bother\b/i.test(recurrence[2])
          ? "Every other Sunday"
          : "Every Sunday",
      );
    else if (/\bSunday\b/i.test(part)) uncertainRecurrence = true;
    const count = countPattern.exec(part);
    if (count && (!count[2] || rangePattern.test(count[2]))) {
      counts.push(numberWords[count[1].toLowerCase()] ?? count[1]);
      if (count[2]) ranges.push(count[2]);
    } else {
      if (/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+people\b/i.test(part))
        uncertainCount = true;
      if (rangePattern.test(part)) ranges.push(part);
      else if (/\bfrom\s+\d[^.!?;\n]*\bto\s+\d/i.test(part))
        uncertainTime = true;
    }
  }
  draft.teamName = uncertainTeam ? "" : uniqueValue(teamNames);
  draft.recurrence = uncertainRecurrence ? "" : uniqueValue(recurrences);
  draft.peopleCount = uncertainCount ? "" : uniqueValue(counts);
  const rangeText = uncertainTime ? "" : uniqueValue(ranges);
  const range = rangePattern.exec(rangeText);
  if (range) {
    const start = clock(range[1]);
    const end = clock(range[2]);
    if (
      start &&
      end &&
      ((start.meridiem && end.meridiem) ||
        (!start.meridiem &&
          !end.meridiem &&
          (start.explicit24h || end.explicit24h)))
    ) {
      draft.time = `${formatClock(start)}–${formatClock(end)}`;
      if (end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
        draft.notes.push(
          "The stated end time is not later than the start time. Confirm whether this crosses midnight and choose the dates explicitly.",
        );
      }
    } else {
      draft.time = `${range[1]} to ${range[2]}`;
      draft.notes.push(
        "The time is copied as written. Confirm AM/PM or use 24-hour times before scheduling; no morning, afternoon, or overnight timing has been inferred.",
      );
    }
  }
  const missing = [
    !draft.teamName && "team name",
    !draft.recurrence && "recurrence",
    !draft.peopleCount && "number of people",
    !draft.time && "time",
  ].filter(Boolean);
  if (missing.length)
    draft.notes.push(
      `Not recognized: ${missing.join(", ")}. Enter these details yourself.`,
    );
  draft.notes.push(
    "First date, time zone, role description, and participants must be supplied. Names do not establish consent, availability, or acceptance.",
  );
  return draft;
}
