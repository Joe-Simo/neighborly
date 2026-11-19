import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { formatDate, type Words } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import { shortMoney } from "@/components/workspace/help-line/format";

export type Board = FunctionReturnType<typeof api.visits.board>;
export type Visit = Board["scheduled"][number];
export type Suggestion = NonNullable<Board["suggested"]>;
type Waiting = Board["toArrange"][number];
export type Visitors = FunctionReturnType<typeof api.visits.visitors>;
export type Sheet = FunctionReturnType<typeof api.visits.sheet>;
export type OwnVisit = FunctionReturnType<typeof api.visits.mine>[number];

/** The room's own words, in the person's language: a helper cannot ask for them, so the component passes them. */
type VisitWords = Words["rooms"]["visitsRoom"];

/** "Rent, $450": what the visit is about, in the words of the request. */
export const need = (words: Words, kind: Waiting["kind"], cents: number) =>
  fill(words.rooms.visitsRoom.need, { kind: words.kinds[kind], amount: shortMoney(cents) });
export const firstName = (name: string) => name.split(/\s+/)[0];
/** The people of a visit named together: "Renee Okafor and Jean-Luc Pierre". The names stay as they are written. */
export const together = (text: VisitWords, names: string[]) =>
  names.length === 2 ? fill(text.pair, { first: names[0], second: names[1] }) : names.join(", ");
/** What a household speaks, in words: one of the three, or the name recorded for another language. */
export const spoken = (text: VisitWords, neighbor: { language: keyof VisitWords["languages"]; languageName?: string }) =>
  neighbor.language === "other" ? neighbor.languageName || text.languages.other : text.languages[neighbor.language];
/** A line that begins with a day: Spanish writes its days small, and a line still begins with a capital. */
export const capital = (line: string) => line.charAt(0).toUpperCase() + line.slice(1);
/** The neighbor's record with one request open, where it is approved or declined. Stream 1's address. */
export const requestHref = (neighborId: string, requestId: string) =>
  `/app/neighbors?neighbor=${neighborId}&request=${requestId}`;
export const sheetHref = (visitId: string) => `/app/visits?sheet=${visitId}`;
/** Where the pair stands: a seat is empty, both said yes, someone cannot go, or someone has yet to answer. */
export function standing(visit: Visit, text: VisitWords) {
  const said = text.standing;
  // The owner removed one of the two for good: the visit is one visitor short.
  const gone = visit.visitors.find((visitor) => visitor.removed);
  // Both removed: no one is left to keep a seat, so the visit is called off and planned again.
  if (gone && visit.visitors.every((visitor) => visitor.removed))
    return { state: "empty" as const, text: said.needsTwo };
  if (gone)
    return {
      state: "short" as const,
      who: gone,
      text: said.needsSecond,
    };
  const declined = visit.visitors.find(
    (visitor) => visitor.response === "declined",
  );
  if (declined)
    return {
      state: "declined" as const,
      who: declined,
      text: said.cannot(firstName(declined.name)),
    };
  const waiting = visit.visitors.filter(
    (visitor) => visitor.response === "pending",
  );
  if (!waiting.length)
    return { state: "accepted" as const, text: said.accepted };
  return {
    state: "waiting" as const,
    text:
      waiting.length === 2
        ? said.waitingBoth
        : said.waitingOn(firstName(waiting[0].name)),
  };
}

/**
 * Why this pair is suggested, in the person's language. The suggestion arrives with its reason written out in
 * English: one of a few fixed sentences, with a weekday, a first name and a language in them. Each is known here
 * and said again whole from the room's words; the day comes from the visit's own time, the language from the
 * request, and the first name is kept as it was sent. A sentence that is not one of them is shown as it arrived.
 */
const noPairReason = "No two home visitors are free on a weekday morning this coming week. Choose a time and a pair yourself.";
/** What the backend says for a language written in by hand that was left without its name. */
const unnamedLanguage = "Another language";
const fixedReason = /^Both are free \S+ and neither is away\.(?: (?:(Both speak)|(\S+) speaks|(No one free that day speaks)) [\s\S]+\.)?$/;
export function reasonIn(text: VisitWords, suggested: Suggestion, weekday: string) {
  const said = text.suggested.reason;
  if (!suggested.pair) return suggested.reason === noPairReason ? said.noPair : suggested.reason;
  const match = fixedReason.exec(suggested.reason);
  if (!match) return suggested.reason;
  const free = said.free(weekday);
  const [, both, speaker, none] = match;
  const { language } = suggested.request;
  if (language === "en" || !(both || speaker || none)) return free;
  const written = suggested.request.languageName?.trim();
  const typed = written === unnamedLanguage ? "" : written;
  const speaks =
    language !== "other"
      ? both ? said[language].both : speaker ? said[language].one(speaker) : said[language].none
      : typed
        ? both ? said.other.both(typed) : speaker ? fill(said.other.one, { name: speaker, language: typed }) : said.other.none(typed)
        : both ? said.unnamed.both : speaker ? said.unnamed.one(speaker) : said.unnamed.none;
  return `${free} ${speaks}`;
}

/**
 * The room's dates, in the person's own language: written long ("November 12"), where the workspace's own
 * are short, as this room has always shown them.
 */
export function useVisitDates(): Workspace["format"] {
  const { data, words } = useWorkspace();
  return (time, options) =>
    formatDate(words.locale, time, { timeZone: data.church.timeZone, month: "long", day: "numeric", ...options });
}
