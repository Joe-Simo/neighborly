import { exportGate, type LanguageReview } from "./approval";
import { languageByCode } from "./languages";

export type PublishLanguage = LanguageReview & { reviewer: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class NotApproved extends Error {}

function assertReady(langs: PublishLanguage[]) {
  const gate = exportGate(langs);
  if (!gate.ready) throw new NotApproved(`${gate.waiting.length} block(s) still need approval.`);
}

/** HTML a church can paste into its website builder. Each language gets the right lang and dir so screen readers and fonts behave. */
export function webSnippet(english: string[], langs: PublishLanguage[]): string {
  assertReady(langs);
  const section = (code: string, dir: string, blocks: string[], note?: string) => {
    const [title, ...rest] = blocks;
    return [
      `<section lang="${esc(code)}" dir="${dir}" class="neighborly-announcement">`,
      `  <h2>${esc(title)}</h2>`,
      ...rest.map((p) => `  <p>${esc(p)}</p>`),
      ...(note ? [`  <p class="neighborly-review"><small>${esc(note)}</small></p>`] : []),
      `</section>`,
    ].join("\n");
  };
  return [
    section("en", "ltr", english.slice(0, -1)),
    ...langs.map((l) => section(l.code, languageByCode(l.code)?.dir ?? "ltr", l.blocks.map((b) => b.text), `Reviewed by ${l.reviewer}`)),
  ].join("\n\n");
}

/** Plain email text: English first, then each approved language under its own heading. */
export function emailText(english: string[], langs: PublishLanguage[]): string {
  assertReady(langs);
  const [subject, ...body] = english.slice(0, -1);
  const parts = [`Subject: ${subject} / ${langs.map((l) => l.blocks[0].text).join(" / ")}`, "", subject, "", ...body.flatMap((p) => [p, ""])];
  for (const l of langs) {
    const lang = languageByCode(l.code);
    parts.push(`---- ${lang?.native ?? l.name} (${lang?.name ?? l.code}) ----`, "");
    l.blocks.forEach((b) => parts.push(b.text, ""));
  }
  return parts.join("\n").trimEnd() + "\n";
}
