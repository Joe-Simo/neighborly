import { exportGate, type LanguageReview } from "./approval";
import { languageByCode } from "./languages";
import { attribution, type Passage, passagesFor } from "./scripture";

export type PublishLanguage = LanguageReview & { reviewer: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class NotApproved extends Error {}

function assertReady(langs: PublishLanguage[]) {
  const gate = exportGate(langs);
  if (!gate.ready) throw new NotApproved(`${gate.waiting.length} block(s) still need approval.`);
}

/** One language as it is published: approved text plus verses from a public-domain Bible (never from AI). */
export type PublishedLanguage = {
  code: string;
  dir: "ltr" | "rtl";
  name: string;
  native: string;
  title: string;
  paragraphs: string[];
  disclosure: string | null;
  verses: Extract<Passage, { kind: "text" }>[];
  /** References with no public-domain text for this language, with the plain note shown in the app. */
  referenceOnly: Extract<Passage, { kind: "reference" }>[];
  reviewer: string | null;
};

function shape(code: string, blocks: string[], englishBlocks: string[], reviewer: string | null, withDisclosure: boolean): PublishedLanguage {
  const lang = languageByCode(code);
  const name = code === "en" ? "English" : (lang?.name ?? code);
  const passages = passagesFor(englishBlocks, code, name);
  const [title, ...rest] = blocks;
  return {
    code,
    dir: lang?.dir ?? "ltr",
    name,
    native: code === "en" ? "English" : (lang?.native ?? code),
    title,
    paragraphs: withDisclosure ? rest.slice(0, -1) : rest,
    disclosure: withDisclosure ? (rest.at(-1) ?? null) : null,
    verses: passages.filter((p): p is Extract<Passage, { kind: "text" }> => p.kind === "text"),
    referenceOnly: passages.filter((p): p is Extract<Passage, { kind: "reference" }> => p.kind === "reference"),
    reviewer,
  };
}

/** Everything that gets published, English first. Throws NotApproved unless every block of every language is approved. */
export function published(english: string[], langs: PublishLanguage[]): PublishedLanguage[] {
  assertReady(langs);
  return [shape("en", english.slice(0, -1), english, null, false), ...langs.map((l) => shape(l.code, l.blocks.map((b) => b.text), english, l.reviewer, true))];
}

/** HTML a church can paste into its website builder. Each language gets the right lang and dir so screen readers and fonts behave. */
export function webSnippet(english: string[], langs: PublishLanguage[]): string {
  const section = (p: PublishedLanguage) =>
    [
      `<section lang="${esc(p.code)}" dir="${p.dir}" class="neighborly-announcement">`,
      `  <h2>${esc(p.title)}</h2>`,
      ...p.paragraphs.map((x) => `  <p>${esc(x)}</p>`),
      ...p.verses.map((v) => `  <blockquote class="neighborly-verse"><p>${esc(v.text)}</p><cite>${esc(attribution(v))}</cite></blockquote>`),
      ...(p.disclosure ? [`  <p><small>${esc(p.disclosure)}</small></p>`] : []),
      ...(p.reviewer ? [`  <p class="neighborly-review"><small>${esc(`Reviewed by ${p.reviewer}`)}</small></p>`] : []),
      `</section>`,
    ].join("\n");
  return published(english, langs).map(section).join("\n\n");
}

/** Plain email text: English first, then each approved language under its own heading. */
export function emailText(english: string[], langs: PublishLanguage[]): string {
  const all = published(english, langs);
  const [en, ...rest] = all;
  const parts = [`Subject: ${[en, ...rest].map((p) => p.title).join(" / ")}`, ""];
  for (const p of all) {
    if (p.code !== "en") parts.push(`---- ${p.native} (${p.name}) ----`, "");
    parts.push(p.title, "", ...p.paragraphs.flatMap((x) => [x, ""]));
    for (const v of p.verses) parts.push(`"${v.text}"`, attribution(v), "");
    if (p.disclosure) parts.push(p.disclosure, "");
  }
  return parts.join("\n").trimEnd() + "\n";
}

/** The one-page flyer for one language. Same gate as the other exports. */
export function flyer(english: string[], langs: PublishLanguage[], code: string): PublishedLanguage {
  const hit = published(english, langs).find((p) => p.code === code);
  if (!hit) throw new NotApproved(`No approved ${code} translation in this announcement.`);
  return hit;
}
