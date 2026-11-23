import type { Words } from "@/lib/words";
import { readDaysParts } from "@/components/workspace/volunteer/days";

/** A span of days as a heading's words: each half keeps together, so two lines break before "to" ("al"), never after it. */
export function DaysWords({ words, start, end }: { words: Words; start: string; end: string }) {
  const parts = readDaysParts(words, start, end);
  return parts.flatMap((part, index) => [
    ...(index ? [" "] : []),
    <span key={index} className="volunteer-days-part">{part}</span>,
  ]);
}
