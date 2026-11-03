// Builds src/data/scripture.json from public-domain Bibles published by eBible.org.
// Run: node scripts/fetch-scripture.mjs. It copies verse text exactly as eBible serves it and records where it came from.
// No AI is involved. Translations whose public-domain status we could not confirm by age are left out on purpose.
import { writeFileSync } from "node:fs";

const TRANSLATIONS = [
  { lang: "en", id: "eng-kjv2006", name: "King James Version", year: "1769 text", status: "Public domain outside the United Kingdom. In the UK the Crown holds rights by letters patent." },
  { lang: "es", id: "spaRV1909", name: "Reina-Valera 1909", year: "1909", status: "Public domain (published 1909)." },
  { lang: "fr", id: "fraLSG", name: "Louis Segond 1910", year: "1910", status: "Public domain (published 1910)." },
  { lang: "de", id: "deu1912", name: "Lutherbibel 1912", year: "1912", status: "Public domain (published 1912)." },
  { lang: "ru", id: "russyn", name: "Synodal Translation", year: "1876", status: "Public domain (published 1876)." },
  { lang: "vi", id: "vie1934", name: "Kinh Thánh (Cadman)", year: "NT 1923, OT 1925", status: "Public domain. eBible.org reports the copyright expired: New Testament on January 1, 2019, Old Testament on January 1, 2021.", namesFromTitle: true },
  { lang: "ko", id: "kor", name: "Korean Bible 1910", year: "1910", status: "Public domain (1910 translation)." },
  { lang: "ar", id: "arb-vd", name: "Smith and Van Dyck", year: "1865", status: "Public domain (published 1865)." },
];

/** A short list of verses churches often cite in invitations. Anything else is shown as a reference only. */
const VERSES = [
  ["LEV", 19, 34],
  ["MAT", 11, 28],
  ["MAT", 25, 35],
  ["LUK", 14, 13],
  ["JHN", 3, 16],
  ["ROM", 15, 7],
  ["HEB", 13, 2],
];

const UA = { "User-Agent": "Neighborly/0.1 (church translation helper; https://github.com/Joe-Simo/neighborly)" };
const get = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const unescape = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function verseText(html, v) {
  const start = html.indexOf(`<span class="verse" id="V${v}">`);
  if (start < 0) return null;
  let rest = html.slice(start).replace(/^<span class="verse" id="V\d+">[^<]*<\/span>/, "");
  const end = rest.search(/<span class="verse" id="V\d+">|<div class=["'](r|s|s1|s2|d|ms|mr|footnote)["']|<ul class=["']tnav|<div class=["']chapterlabel/);
  if (end >= 0) rest = rest.slice(0, end);
  const text = unescape(
    rest
      .replace(/<a [^>]*class=["']notemark["'][\s\S]*?<\/a>/g, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00b6/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function statement(page) {
  const at = page.search(/Public Domain/i);
  let s = page.slice(at, at + 420);
  const stop = s.search(/HTML generated|This free Bible|\d{4}-\d{2}-\d{2}/);
  if (stop > 0) s = s.slice(0, stop);
  else if (s.lastIndexOf(". ") > 0) s = s.slice(0, s.lastIndexOf(". ") + 1);
  return s.replace(/[\u2013\u2014]/g, ",").replace(/\s+/g, " ").trim();
}

const titleCase = (s) => s.toLocaleLowerCase("vi").replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase("vi"));

const out = { generatedAt: new Date().toISOString(), method: "Copied from eBible.org chapter pages by scripts/fetch-scripture.mjs. No AI.", sources: {}, books: {}, verses: {} };

for (const t of TRANSLATIONS) {
  const copyright = unescape((await get(`https://ebible.org/${t.id}/copyright.htm`)).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  if (!/Public Domain|domaine public|Dominio P/i.test(copyright)) throw new Error(`${t.id}: no public domain statement found`);
  const index = await get(`https://ebible.org/${t.id}/index.htm`);
  const books = {};
  for (const [code] of VERSES) {
    const m = index.match(new RegExp(`href=['"]${code}\\d+\\.htm['"]>([^<]+)`));
    if (!m) throw new Error(`${t.id}: no name for ${code}`);
    books[code] = unescape(m[1]).trim();
  }
  out.books[t.lang] = books;
  out.sources[t.lang] = {
    id: t.id,
    name: t.name,
    year: t.year,
    status: t.status,
    evidence: `https://ebible.org/${t.id}/copyright.htm`,
    statement: statement(copyright),
  };
  for (const [code, ch, v] of VERSES) {
    let html = null;
    for (const pad of [2, 3]) {
      try {
        html = await get(`https://ebible.org/${t.id}/${code}${String(ch).padStart(pad, "0")}.htm`);
        break;
      } catch {}
    }
    if (!html) throw new Error(`${t.id}: missing ${code} ${ch}`);
    const text = verseText(html, v);
    if (!text) throw new Error(`${t.id}: missing ${code} ${ch}:${v}`);
    const key = `${code}.${ch}.${v}`;
    if (t.namesFromTitle) {
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
      const m = unescape(title).match(/Kinh Thánh (.+?) \d+$/);
      if (!m) throw new Error(`${t.id}: no title name for ${code}`);
      out.books[t.lang][code] = titleCase(m[1]);
    }
    out.verses[key] ??= {};
    out.verses[key][t.lang] = { text, url: `https://ebible.org/${t.id}/${code}${String(ch).padStart(code === "PSA" ? 3 : 2, "0")}.htm#V${v}` };
  }
  console.log(`${t.id}: ok`);
}

writeFileSync(new URL("../src/data/scripture.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("wrote src/data/scripture.json");
