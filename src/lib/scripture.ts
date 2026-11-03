import data from "@/data/scripture.json";
import { findReferences, refLabel, type ScriptureRef } from "./scripture-ref";

/**
 * Verse text comes only from the public-domain Bibles bundled in src/data/scripture.json (copied from eBible.org
 * by scripts/fetch-scripture.mjs). The model never writes verse text. Anything not bundled is shown as a reference.
 */

export type ScriptureSource = { id: string; name: string; year: string; status: string; evidence: string; statement: string };

type Data = {
  sources: Record<string, ScriptureSource>;
  books: Record<string, Record<string, string>>;
  verses: Record<string, Record<string, { text: string; url: string }>>;
};
const D = data as Data;

export const SCRIPTURE_SOURCES = D.sources;

export type Passage =
  | { kind: "text"; ref: ScriptureRef; english: string; label: string; text: string; source: ScriptureSource; url: string }
  | { kind: "reference"; ref: ScriptureRef; english: string; reason: "no-source" | "not-bundled"; note: string };

export function englishLabel(ref: ScriptureRef): string {
  return refLabel(D.books.en?.[ref.code] ?? ref.raw.replace(/\s+\d.*$/, ""), ref);
}

/** Verse text for one reference in one language, or a plain note saying why there is none. */
export function passage(ref: ScriptureRef, lang: string, languageName = lang): Passage {
  const english = englishLabel(ref);
  const source = D.sources[lang];
  if (!source) {
    return {
      kind: "reference",
      ref,
      english,
      reason: "no-source",
      note: `Neighborly has no verified public-domain ${languageName} Bible, so it does not insert the verse. The reference stays in the text so readers can look it up in their own Bible.`,
    };
  }
  const verses: { text: string; url: string }[] = [];
  for (let v = ref.from; v <= ref.to; v++) {
    const hit = D.verses[`${ref.code}.${ref.chapter}.${v}`]?.[lang];
    if (!hit) {
      return {
        kind: "reference",
        ref,
        english,
        reason: "not-bundled",
        note: `${english} is not in Neighborly's bundled verse list yet, so only the reference is shown. Nothing is generated.`,
      };
    }
    verses.push(hit);
  }
  const book = D.books[lang]?.[ref.code] ?? english;
  return { kind: "text", ref, english, label: refLabel(book, ref), text: verses.map((v) => v.text).join(" "), source, url: verses[0].url };
}

/** Every distinct reference in the English blocks, in order. */
export function referencesIn(blocks: string[]): ScriptureRef[] {
  const seen = new Set<string>();
  const out: ScriptureRef[] = [];
  for (const b of blocks) {
    for (const r of findReferences(b)) {
      const k = `${r.code}.${r.chapter}.${r.from}.${r.to}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
  }
  return out;
}

export function passagesFor(englishBlocks: string[], lang: string, languageName?: string): Passage[] {
  return referencesIn(englishBlocks).map((r) => passage(r, lang, languageName));
}

/** The line printed under a verse, e.g. "Hebreos 13:2 (Reina-Valera 1909)". Public-domain status is in the README and on /limits. */
export const attribution = (p: Extract<Passage, { kind: "text" }>) => `${p.label} (${p.source.name})`;
