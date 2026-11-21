/**
 * Whether two household records may be the same household, by what code can compare on its own: the phone, the
 * street address and the name. Nothing here goes to the model; the model only ever reads the two records' notes.
 */
import { nameKey, phoneKey } from "./keys";

export type SameBy = "phone" | "address" | "name";
export interface Comparable { name: string; phone: string; address: string }

/** Street words written the long way and the short way, in English and Spanish, folded to one spelling. */
const streetWords: Record<string, string> = {
  street: "st", st: "st", avenue: "ave", ave: "ave", av: "ave", avenida: "ave", road: "rd", rd: "rd", drive: "dr", dr: "dr",
  boulevard: "blvd", blvd: "blvd", lane: "ln", ln: "ln", court: "ct", ct: "ct", place: "pl", pl: "pl", circle: "cir", cir: "cir",
  terrace: "ter", ter: "ter", highway: "hwy", hwy: "hwy", parkway: "pkwy", pkwy: "pkwy", calle: "st",
  north: "n", n: "n", south: "s", s: "s", east: "e", e: "e", west: "w", w: "w", norte: "n", sur: "s", este: "e", oeste: "w",
  apartment: "#", apt: "#", unit: "#", suite: "#", ste: "#", apto: "#", departamento: "#", depto: "#",
};
/** An address as it is compared: small letters, no accents or punctuation, street words in one spelling, the unit kept, the city and ZIP left out. */
export function addressKey(address: string) {
  const [first = "", ...rest] = address.split(/[,\n]/);
  const unit = rest.find((part) => /^\s*(#|apt|apartment|unit|suite|ste|apto|depto|departamento)\b/i.test(part)) ?? "";
  const street = `${first} ${unit}`;
  return nameKey(street.replace(/#/g, " apt ")).split(" ").map((word) => streetWords[word] ?? word)
    .filter((word, index, all) => word && !(/^\d{5}$/.test(word) && index === all.length - 1)).join(" ");
}

/** Jaro-Winkler likeness of two words, 0 to 1. */
function likeness(a: string, b: string) {
  if (a === b) return 1;
  const reach = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const takenA: boolean[] = [], takenB: boolean[] = [];
  let matches = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = Math.max(0, i - reach); j < Math.min(b.length, i + reach + 1); j++)
      if (!takenB[j] && a[i] === b[j]) { takenA[i] = takenB[j] = true; matches++; break; }
  if (!matches) return 0;
  let turns = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!takenA[i]) continue;
    while (!takenB[k]) k++;
    if (a[i] !== b[k]) turns++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - turns / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * How alike two names are, 0 to 1, whatever order their words are in: each word of the shorter name is matched to its
 * likeliest word in the longer one. A second family name ("García López") or a dropped middle name still counts close.
 */
export function nameLikeness(a: string, b: string) {
  const [short, long] = [nameKey(a).split(" ").filter(Boolean), nameKey(b).split(" ").filter(Boolean)].sort((x, y) => x.length - y.length);
  if (!short.length) return 0;
  const left = [...long];
  let total = 0;
  for (const word of short) {
    let best = -1, at = -1;
    left.forEach((other, index) => {
      // An initial matches the word it starts.
      const score = word.length === 1 || other.length === 1 ? (word[0] === other[0] ? 0.9 : 0) : likeness(word, other);
      if (score > best) { best = score; at = index; }
    });
    if (at >= 0) left.splice(at, 1);
    total += Math.max(0, best);
  }
  return total / short.length;
}

/** At or above this two names count as alike. Set on the made-up pairs in duplicate-set.ts, never on the held-out ones. */
export const namesAlike = 0.88;

/** What two records share, in the order a person would trust it. Empty when they share nothing code can see. */
export function sameBy(a: Comparable, b: Comparable): SameBy[] {
  const phone = phoneKey(a.phone);
  const address = addressKey(a.address);
  return [
    ...(phone.length >= 7 && phone === phoneKey(b.phone) ? ["phone" as const] : []),
    ...(address && /\d/.test(address) && address === addressKey(b.address) ? ["address" as const] : []),
    ...(nameLikeness(a.name, b.name) >= namesAlike ? ["name" as const] : []),
  ];
}

/**
 * Two things code can see in common are enough to ask a person. One alone (a shared family phone, two families at one
 * address, a common name) is shown only when the model also reads the two records' notes as the same household.
 */
export const needsNotes = (shared: SameBy[]) => shared.length < 2;

/**
 * Public intake: the household a verified request from outside belongs to, when code is sure enough to attach it for the
 * team to confirm. The same phone, or a name alike at the same street address; a name alone, or an address alone, is not
 * enough from a stranger's form. The phone wins over the name and address; among several, the likeliest name. No model.
 */
export function intakeMatch<Household extends Comparable>(request: Comparable, households: Household[]): { household: Household; by: "phone" | "name_address" } | null {
  const scored = households.flatMap((household) => {
    const shared = sameBy(request, household);
    const by = shared.includes("phone") ? "phone" as const : shared.includes("name") && shared.includes("address") ? "name_address" as const : null;
    return by ? [{ household, by, rank: (by === "phone" ? 2 : 0) + nameLikeness(request.name, household.name) }] : [];
  });
  const best = scored.sort((a, b) => b.rank - a.rank)[0];
  return best ? { household: best.household, by: best.by } : null;
}
