export const requestKinds = ["rent", "utility", "food", "voucher", "other"] as const;
export type RequestKind = (typeof requestKinds)[number];
/** Who is paid. A draft never proposes paying the neighbor. */
export const draftPayeeKinds = ["landlord", "utility", "vendor"] as const;
export type DraftPayeeKind = (typeof draftPayeeKinds)[number];

export interface RequestDraft {
  kind: RequestKind | null;
  /** Whole cents. */
  amountRequested: number | null;
  payeeKind: DraftPayeeKind | null;
  payeeName: string;
  /** The sentence of the note the amount or kind came from, and the one that names who is paid, for the person to read beside the draft. */
  quote: string;
  notes: string[];
}

const kindWords: Record<Exclude<RequestKind, "other">, RegExp> = {
  rent: /\b(?:rent|landlord|lease|evict(?:ion|ed)?|renta|alquiler)\b/i,
  utility: /\b(?:electric(?:ity)?|power|light bill|water bill|gas bill|utilit(?:y|ies)|shut-?off|fpl|lcec|teco|luz|electricidad)\b/i,
  food: /\b(?:food|groceries|pantry|comida)\b/i,
  voucher: /\b(?:voucher|thrift|furniture|clothes|clothing|mattress|bed|ropa|muebles)\b/i,
};
const payeeWords: Record<DraftPayeeKind, RegExp> = {
  landlord: /\b(?:landlord|property manager|leasing office)\b/i,
  utility: /\b(?:electric company|power company|water company|gas company|utility company|fpl|lcec|teco)\b/i,
  vendor: /\b(?:thrift store|store|grocer)\b/i,
};
/** Local utilities a volunteer writes by their initials. */
const utilityNames = /\b(FPL|LCEC|TECO)\b/;
const payeeIntroPattern = /\b(?:(?:landlord|property manager|leasing office|electric company|power company|water company)\s+is|(?:paid|owed|payable|due)\s+to)\s+/i;
/** What a payee's own name says it is: "County Water Authority" is a utility. A name that says nothing gives nothing. */
const nameKinds: Record<DraftPayeeKind, RegExp> = {
  landlord: /\b(?:apartments?|properties|property|realty|rentals|homes)\b/i,
  utility: /\b(?:water|electric|power|gas|light|energy)\b.*\b(?:authority|utility|utilities|company|co|co-?op|cooperative|department|district|works|services?)\b|\butilit(?:y|ies)\b/i,
  vendor: /\b(?:pharmacy|shop|store|market|grocery|garage)\b/i,
};
const properNamePattern = /^(?:\p{Lu}[\p{L}\p{N}&'.]*)(?:\s+(?:\p{Lu}[\p{L}\p{N}&'.]*|of|and|&))*/u;
/** "The landlord is Sample Property Co." or "Paid to County Water Authority" gives the name; anything less plain gives nothing. */
function statedPayee(clause: string): string | undefined {
  const intro = payeeIntroPattern.exec(clause);
  return intro ? properNamePattern.exec(clause.slice(intro.index + intro[0].length))?.[0] : undefined;
}
/** Ways a note names who is paid without saying what they are: "Pay Mill Road Rentals", "check out to …", "her landlord, Mill Road Rentals". */
const looseIntroPattern = /\b(?:pay(?:\s+to)?|(?:check|cheque)(?:\s+(?:is\s+)?(?:made\s+)?out)?\s+to|(?:landlord|property manager|leasing office|electric company|power company|water company|gas company|utility company)(?:['’]s\s+name\s+is|,)?)\s+/gi;
/**
 * A name after one of those counts only when the name says what it is ("Rentals") or the sentence does ("landlord").
 * "Pay Jordan" may be anyone, the neighbor included, so it gives nothing; a kind of help ("Pay Rent") is no name.
 */
function namedPayee(clause: string): string | undefined {
  for (const intro of clause.matchAll(looseIntroPattern)) {
    const name = properNamePattern.exec(clause.slice(intro.index + intro[0].length))?.[0];
    if (!name || (!name.includes(" ") && Object.values(kindWords).some((kind) => kind.test(name)))) continue;
    if (draftPayeeKinds.some((kind) => nameKinds[kind].test(name) || payeeWords[kind].test(clause))) return name;
  }
  return undefined;
}
const amountToPattern = /(?:\$\s?[\d,.]*\d|\b(?:dollars|bucks))\s+to\s+/i;
/**
 * "$140 to Sample Power Company" names who is paid only when the name says what it is or the sentence does
 * ("the utility company"). "$50 to Jordan" may be anyone, the neighbor included, so it gives nothing.
 */
function amountPayee(clause: string): string | undefined {
  const intro = amountToPattern.exec(clause);
  const name = intro && properNamePattern.exec(clause.slice(intro.index + intro[0].length))?.[0];
  return name && draftPayeeKinds.some((kind) => nameKinds[kind].test(name) || payeeWords[kind].test(clause)) ? name : undefined;
}
const unsure = /\?|\b(?:not|no|never|n't|if|maybe|might|unless|or|either|doesn't|don't|didn't|won't|isn't|wasn't|sin|nunca|quiz[aá]s?)\b/i;

const units: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const numberWord = `(?:${Object.keys(units).join("|")}|hundred|thousand|and)`;
const spokenPattern = new RegExp(`\\b${numberWord}(?:[\\s-]+${numberWord})*\\b(\\s+(?:dollars|bucks))?`, "gi");
const writtenPattern = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?!\d)|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s*(?:dollars|bucks)\b/gi;

/** "four hundred fifty" is 450; null when the words do not make one plain number. */
function spoken(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const word of words) {
    if (word === "and") continue;
    if (word === "hundred") {
      if (!current || current > 99) return null;
      current *= 100;
    } else if (word === "thousand") {
      if (!current) return null;
      total += current * 1000;
      current = 0;
    } else current += units[word];
    seen = true;
  }
  return seen ? total + current : null;
}

/** Every amount of money a clause states, in cents. A bare count ("family of five") is not money. */
function amounts(clause: string): number[] {
  const found: number[] = [];
  for (const match of clause.matchAll(writtenPattern)) {
    const whole = Number((match[1] ?? match[3]).replaceAll(",", ""));
    found.push(whole * 100 + Number(match[2] ?? match[4] ?? 0));
  }
  for (const match of clause.matchAll(spokenPattern)) {
    const said = match[0].toLowerCase().replace(/\s+(?:dollars|bucks)$/, "").split(/[\s-]+/);
    if (!match[1] && !said.includes("hundred") && !said.includes("thousand")) continue;
    const value = spoken(said);
    if (value) found.push(value * 100);
  }
  return found;
}

/** What stands before a capitalised word in the same sentence: a word, number or closing mark, then spaces. Tested on the
 * text before the word, so no lookbehind is needed (Safari before 16.4 cannot parse one). */
const afterWord = /[\p{L}\p{N}\],'’"”)]\s+$/u;

function clauses(note: string): string[] {
  return note.replace(/\?/g, "?\n").replace(/([.!;])\s+/g, "$1\n").split(/\n+/).map((part) => part.trim()).filter(Boolean);
}

function only<T>(values: T[]): T | null {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

/** How many times a group may ask the model in one month. At Jev's price this is a few cents; it is here so a mistake cannot run up a bill. */
export const monthlyAllowance = 2000;
/**
 * Every line a draft can carry about a blank field, in English. The screen finds each by its key and says it in
 * the reader's language (words.assistant.notes), so a line added here needs its translations there.
 */
export const draftNotes = {
  kindSeveral: "The note mentions more than one kind of help. Choose one, or make a request for each.",
  kindMissing: "The note does not say what kind of help is asked for.",
  amountSeveral: "The note gives more than one amount. Enter the amount asked for.",
  amountMissing: "The note does not give an amount.",
  payee: "Confirm who is paid. Payment goes to the landlord, utility or store, never to the neighbor.",
  doubtful: "Part of the note is a question or is unsure, so it was left out.",
  confirmKind: "Please confirm the kind of help.",
  confirmPayee: "Please confirm who is paid.",
};
/** What a draft says when code proposes no kind of help. Taken back off when the model reads a kind the code could not. */
export const kindNotes = { several: draftNotes.kindSeveral, missing: draftNotes.kindMissing };
/**
 * Copies what a call note states plainly into the shape of a request for help.
 * It proposes; it does not infer need, eligibility or a decision, and it saves nothing.
 */
export function prepareRequestDraft(note: string): RequestDraft {
  const kinds: Exclude<RequestKind, "other">[] = [];
  const payees: DraftPayeeKind[] = [];
  const sums: number[] = [];
  const names: string[] = [];
  let quote = "";
  let amountQuote = "";
  let payeeQuote = "";
  let doubtful = false;
  for (const clause of clauses(note)) {
    const stated = amounts(clause);
    const mentioned = (Object.keys(kindWords) as (keyof typeof kindWords)[]).filter((kind) => kindWords[kind].test(clause));
    if (unsure.test(clause)) {
      // A question, a negation or an "if" states nothing; what it mentions must be confirmed by a person.
      if (stated.length || mentioned.length) doubtful = true;
      continue;
    }
    kinds.push(...mentioned);
    sums.push(...stated);
    payees.push(...draftPayeeKinds.filter((payee) => payeeWords[payee].test(clause)));
    const payee = statedPayee(clause) ?? amountPayee(clause) ?? namedPayee(clause);
    if (payee) payees.push(...draftPayeeKinds.filter((kind) => nameKinds[kind].test(payee)));
    const name = payee ?? utilityNames.exec(clause)?.[1];
    if (name) names.push(name.replace(/[.,]$/, ""));
    // The sentence that names who is paid is read beside the draft too, so the name in its title can be checked.
    if (name && !payeeQuote) payeeQuote = clause;
    // The sentence with the amount is the one a person most needs to read; a sentence naming the kind is second best.
    if (stated.length && !amountQuote) amountQuote = clause;
    else if (mentioned.length && !quote) quote = clause;
  }
  const draft: RequestDraft = {
    kind: only(kinds),
    amountRequested: only(sums),
    payeeKind: only(payees),
    payeeName: only(names) ?? "",
    quote: [...new Set([amountQuote || quote, only(names) ? payeeQuote : ""])].filter(Boolean).join(" "),
    notes: [],
  };
  if (draft.kind === null) draft.notes.push(new Set(kinds).size > 1 ? kindNotes.several : kindNotes.missing);
  if (draft.amountRequested === null) draft.notes.push(new Set(sums).size > 1 ? draftNotes.amountSeveral : draftNotes.amountMissing);
  if (draft.payeeKind === null || !draft.payeeName) draft.notes.push(draftNotes.payee);
  if (doubtful) draft.notes.push(draftNotes.doubtful);
  return draft;
}

const streetWords = "st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pkwy|parkway|ter|terrace|pl|place|trl|trail|hwy|highway|calle|avenida";
const addressPattern = new RegExp(`\\b\\d{1,6}\\s+(?:[\\p{L}\\p{N}.']+\\s+){0,4}(?:${streetWords})\\b(?:\\.?,?\\s*(?:apt|apartment|unit|lot|suite|ste|#)\\.?\\s*[\\p{L}\\p{N}-]+)?`, "giu");
/** Days and months in the three languages a note is written in. A schedule is not identity, and the model needs it. */
const calendarWords = [
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre",
  "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo",
  "janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "jiye", "out", "septanm", "oktòb", "oktob", "novanm", "desanm",
  "lendi", "madi", "mèkredi", "mekredi", "jedi", "vandredi", "samdi", "dimanch",
];
const safeCapitals = new Set(["i", "fpl", "lcec", "teco", ...calendarWords]);
/** "Tuesdays" and "sábados" are as safe as "Tuesday" and "sábado". */
const isSafe = (word: string) => safeCapitals.has(word.toLowerCase()) || safeCapitals.has(word.toLowerCase().replace(/s$/, ""));
/** Months and days that are also given names. Before a surname ("April Johnson", "Julio Reyes") they are a person. */
const alsoNames = "April|May|June|August|Abril|Julio|Domingo|Mercedes";

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The note as the model may see it: no name, phone, email, address or date of birth.
 * Known names and addresses (the caller's, the neighbor's) go first. Then anything
 * shaped like one goes too, including every capitalised word that does not open a
 * sentence, so a landlord's or a child's name leaves with the rest.
 */
/** Edits between two words (insert, delete, change one letter, or swap two side by side), stopping once past `most`. */
function edits(a: string, b: string, most: number) {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let before = Array.from({ length: b.length + 1 }, (_, j) => j);
  let previous = before;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(before[j] + 1, row[j - 1] + 1, before[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], previous[j - 2] + 1);
    }
    previous = before;
    before = row;
    if (Math.min(...row) > most) return most + 1;
  }
  return before[b.length];
}
/**
 * A household's name misspelled ("Delgadoo", "Rosaa", "Okafur") is still their name. A word of four letters or more that
 * starts with the same letter as a name part and is one edit from it (two for a part of eight letters or more) goes too.
 * `anyCase` also takes lowercase words: right for text leaving to people, where a lost word costs less than a kept name.
 */
export function withoutNearNames(text: string, names: string[], anyCase = false): string {
  const parts = [...new Set(names.flatMap((name) => name.split(/\s+/)).map((part) => part.replace(/[^\p{L}'-]/gu, "").toLowerCase()).filter((part) => part.length >= 4))];
  if (!parts.length) return text;
  return text.replace(/\p{L}[\p{L}'’-]*/gu, (word) => {
    if (word.length < 4 || (!anyCase && !/^\p{Lu}/u.test(word)) || isSafe(word)) return word;
    const lower = word.toLowerCase();
    return parts.some((part) => part[0] === lower[0] && edits(lower, part, part.length >= 8 ? 2 : 1) <= (part.length >= 8 ? 2 : 1)) ? "[name]" : word;
  });
}

export function withoutIdentity(note: string, known: { names: string[]; addresses: string[]; others?: string[] }): string {
  let text = note;
  for (const address of known.addresses.map((value) => value.trim()).filter((value) => value.length > 3))
    text = text.replace(new RegExp(escape(address), "gi"), "[address]");
  text = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    // A phone goes before an address, so a number such as 555-0142 is never split by a street after it.
    .replace(/(^|[^\d$])\+?\(?\d(?:[\s().-]*\d){6,}(?!\d)/g, "$1[phone]")
    .replace(addressPattern, "[address]")
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "[date]");
  const parts = known.names.flatMap((name) => name.split(/\s+/)).map((part) => part.replace(/[^\p{L}'-]/gu, "")).filter((part) => part.length > 1);
  for (const part of new Set(parts))
    text = text.replace(new RegExp(`(^|[^\\p{L}])${escape(part)}(?![\\p{L}])`, "giu"), "$1[name]");
  // The household's own names, misspelled, wherever written with a capital (a sentence's first word included).
  text = withoutNearNames(text, known.names);
  // Everyone else the conference knows (its neighbors and members): taken out wherever written with a capital, in one
  // pass. Only the capitalised form, so a neighbor named Hope or Will never takes the plain word out of a note.
  const others = [...new Set((known.others ?? []).flatMap((name) => name.split(/\s+/)).map((part) => part.replace(/[^\p{L}'-]/gu, "")))]
    .filter((part) => part.length > 1 && /^\p{Lu}/u.test(part) && !isSafe(part));
  if (others.length) text = text.replace(new RegExp(`(^|[^\\p{L}])(?:${others.map(escape).join("|")})(?![\\p{L}])`, "gu"), "$1[name]");
  text = text
    .replace(/\b((?:my name is|name is|this is|i am|i'm|me llamo|soy)\s+)[\p{L}'-]+(?:\s+[\p{L}'-]+)?/giu, "$1[name]")
    .replace(/\b(?:mr|mrs|ms|miss|dr|sr|sra|fr|father|sister|deacon)\.?\s+[\p{L}'-]+/giu, "[name]")
    // A capitalised word after another word in the same sentence is a proper noun.
    .replace(/\p{Lu}[\p{L}\p{N}'’&-]*/gu, (word, at: number, whole: string) => (afterWord.test(whole.slice(0, at)) && !isSafe(word) ? "[name]" : word))
    .replace(new RegExp(`\\b(?:${alsoNames})(?=\\s+\\[name\\])`, "g"), "[name]")
    // A sentence that opens with two capitalised words opens with a name.
    .replace(/(^|[.!?]\s+)\p{Lu}[\p{L}'’-]*(?=\s+\[name\])/gu, "$1[name]");
  return text.replace(/\[name\](?:\s+\[name\])+/g, "[name]");
}
