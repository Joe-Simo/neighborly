import { z } from "zod";
import { type CensusGroupId, GROUP_NOTES, languagesForGroup } from "./languages";

/** ACS table C16001: "Language Spoken at Home for the Population 5 Years and Over". */
export const TABLE_ID = "C16001";

/** The 12 language buckets in C16001, in table order. Column n is the bucket total, n+1 "very well", n+2 "less than very well". */
export const C16001_GROUPS: { id: CensusGroupId; label: string; column: number }[] = [
  { id: "spanish", label: "Spanish", column: 3 },
  { id: "french-haitian-cajun", label: "French, Haitian, or Cajun", column: 6 },
  { id: "german-west-germanic", label: "German or other West Germanic", column: 9 },
  { id: "slavic", label: "Russian, Polish, or other Slavic", column: 12 },
  { id: "other-indo-european", label: "Other Indo-European", column: 15 },
  { id: "korean", label: "Korean", column: 18 },
  { id: "chinese", label: "Chinese (incl. Mandarin, Cantonese)", column: 21 },
  { id: "vietnamese", label: "Vietnamese", column: 24 },
  { id: "tagalog", label: "Tagalog (incl. Filipino)", column: 27 },
  { id: "other-asian-pacific", label: "Other Asian and Pacific Island", column: 30 },
  { id: "arabic", label: "Arabic", column: 33 },
  { id: "other", label: "Other and unspecified", column: 36 },
];

export const zipSchema = z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code");

export type LanguageGroup = {
  id: CensusGroupId;
  label: string;
  speakers: number;
  speakersMoe: number | null;
  limitedEnglish: number;
  limitedEnglishMoe: number | null;
  /** Share of all residents 5 and over who speak this language at home. */
  share: number;
  /** Share of this language's speakers who speak English less than "very well". */
  limitedShare: number;
  /** True when the margin of error is at least half the estimate. */
  lowReliability: boolean;
  suggest: string[];
  note?: string;
};

export type NeighborhoodLanguages = {
  zip: string;
  release: { id: string; name: string; years: string };
  source: "censusreporter" | "census.gov";
  total: number;
  englishOnly: number;
  otherLanguages: number;
  limitedEnglish: number;
  groups: LanguageGroup[];
};

const col = (n: number) => `C16001${String(n).padStart(3, "0")}`;
const num = z.number().finite();

const reporterSchema = z.object({
  data: z.record(z.string(), z.object({ C16001: z.object({ estimate: z.record(z.string(), num), error: z.record(z.string(), num).optional() }) })),
  release: z.object({ id: z.string(), name: z.string(), years: z.string() }),
});

/** Census Reporter (censusreporter.org) serves the same ACS release as JSON keyed by column id. */
export function parseCensusReporter(zip: string, raw: unknown): NeighborhoodLanguages {
  const parsed = reporterSchema.safeParse(raw);
  if (!parsed.success) throw new CensusError("unexpected", "The Census data came back in a shape we did not expect.");
  const geo = parsed.data.data[`86000US${zip}`];
  if (!geo) throw new CensusError("not-found", `No Census data for ZIP ${zip}.`);
  const est = geo.C16001.estimate;
  const err = geo.C16001.error ?? {};
  return build(zip, parsed.data.release, "censusreporter", (n) => est[col(n)], (n) => err[col(n)]);
}

/** api.census.gov returns [[header...], [values...]] with variables named C16001_003E (estimate) and C16001_003M (margin). */
export function parseCensusGov(zip: string, raw: unknown, release = { id: "acs2024_5yr", name: "ACS 2024 5-year", years: "2020-2024" }): NeighborhoodLanguages {
  const rows = z.array(z.array(z.union([z.string(), z.number(), z.null()]))).min(2).safeParse(raw);
  if (!rows.success) throw new CensusError("not-found", `No Census data for ZIP ${zip}.`);
  const [header, values] = rows.data;
  const pick = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) return undefined;
    const v = Number(values[i]);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const v = (n: number) => `C16001_${String(n).padStart(3, "0")}`;
  return build(zip, release, "census.gov", (n) => pick(`${v(n)}E`), (n) => pick(`${v(n)}M`));
}

function build(
  zip: string,
  release: NeighborhoodLanguages["release"],
  source: NeighborhoodLanguages["source"],
  est: (n: number) => number | undefined,
  moe: (n: number) => number | undefined,
): NeighborhoodLanguages {
  const total = est(1);
  const englishOnly = est(2);
  if (total === undefined || englishOnly === undefined) throw new CensusError("unexpected", "The Census data is missing the table totals.");
  const groups: LanguageGroup[] = C16001_GROUPS.map((g) => {
    const speakers = est(g.column) ?? 0;
    const limitedEnglish = est(g.column + 2) ?? 0;
    const speakersMoe = moe(g.column) ?? null;
    return {
      id: g.id,
      label: g.label,
      speakers,
      speakersMoe,
      limitedEnglish,
      limitedEnglishMoe: moe(g.column + 2) ?? null,
      share: total > 0 ? speakers / total : 0,
      limitedShare: speakers > 0 ? limitedEnglish / speakers : 0,
      lowReliability: speakersMoe !== null && speakers > 0 ? speakersMoe >= speakers * 0.5 : speakers === 0,
      suggest: languagesForGroup(g.id).map((l) => l.code),
      note: GROUP_NOTES[g.id],
    };
  }).sort((a, b) => b.speakers - a.speakers || b.limitedEnglish - a.limitedEnglish);
  return {
    zip,
    release,
    source,
    total,
    englishOnly,
    otherLanguages: Math.max(0, total - englishOnly),
    limitedEnglish: groups.reduce((s, g) => s + g.limitedEnglish, 0),
    groups,
  };
}

/** Languages worth suggesting: real speakers, a single-language bucket, ranked by people who need it most. */
/**
 * Pre-select up to three languages, ranked by how many neighbors speak English less than "very well".
 * Groups with fewer than MIN_LIMITED such neighbors are left for the church to pick by hand.
 */
export const MIN_LIMITED = 50;

export function suggestedLanguages(n: NeighborhoodLanguages, max = 3): string[] {
  const out: string[] = [];
  const ranked = [...n.groups].filter((g) => g.suggest.length > 0 && g.limitedEnglish >= MIN_LIMITED).sort((a, b) => b.limitedEnglish - a.limitedEnglish || b.speakers - a.speakers);
  for (const g of ranked) {
    if (out.length >= max) break;
    out.push(g.suggest[0]);
  }
  return out;
}

export class CensusError extends Error {
  constructor(public code: "not-found" | "unexpected" | "unavailable", message: string) {
    super(message);
  }
}
