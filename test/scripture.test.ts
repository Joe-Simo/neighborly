import { describe, expect, it } from "vitest";
import data from "@/data/scripture.json";
import { approve, unapprove } from "@/lib/approval";
import { addedVerseText, extractFacts, flagBlock } from "@/lib/checks";
import { emailText, flyer, NotApproved, webSnippet, type PublishLanguage } from "@/lib/publish";
import { attribution, passage, passagesFor, referencesIn, SCRIPTURE_SOURCES } from "@/lib/scripture";
import { findReferences, quotesScripture } from "@/lib/scripture-ref";

describe("finding references", () => {
  it("finds book, chapter and verse, with ranges and numbered books", () => {
    expect(findReferences("Our theme is Hebrews 13:2 this week.")).toMatchObject([{ code: "HEB", chapter: 13, from: 2, to: 2 }]);
    expect(findReferences("Read Matt. 25:35-36 and 1 John 4:7.")).toMatchObject([
      { code: "MAT", chapter: 25, from: 35, to: 36 },
      { code: "1JN", chapter: 4, from: 7, to: 7 },
    ]);
  });

  it("does not mistake a time for a verse", () => {
    expect(findReferences("Mark 10:30 AM on your calendar")).toEqual([]);
    expect(findReferences("We meet at 10:30 for a job fair")).toEqual([]);
  });

  it("ignores implausible ranges", () => {
    expect(findReferences("John 3:1-80")).toEqual([]);
  });

  it("spots a quoted verse next to its reference", () => {
    expect(quotesScripture('Hebrews 13:2 says "Be not forgetful to entertain strangers".')).toBe(true);
    expect(quotesScripture("Our theme comes from Hebrews 13:2.")).toBe(false);
  });
});

describe("inserting verse text", () => {
  const [heb] = findReferences("Hebrews 13:2");

  it("uses only the bundled public-domain text, with its source", () => {
    const es = passage(heb, "es", "Spanish");
    expect(es.kind).toBe("text");
    if (es.kind !== "text") return;
    expect(es.text).toBe((data.verses as Record<string, Record<string, { text: string }>>)["HEB.13.2"].es.text);
    expect(es.source.name).toBe("Reina-Valera 1909");
    expect(es.url).toMatch(/^https:\/\/ebible\.org\/spaRV1909\//);
    expect(attribution(es)).toBe("Hebreos 13:2 (Reina-Valera 1909)");
  });

  it("shows only the reference, with a note, when a language has no verified source", () => {
    const ht = passage(heb, "ht", "Haitian Creole");
    expect(ht).toMatchObject({ kind: "reference", reason: "no-source", english: "Hebrews 13:2" });
    if (ht.kind === "reference") expect(ht.note).toMatch(/no verified public-domain Haitian Creole Bible/);
    expect(passage(heb, "zh-Hans").kind).toBe("reference");
  });

  it("shows only the reference when the verse is not bundled", () => {
    const [ref] = findReferences("Genesis 1:1");
    expect(passage(ref, "es", "Spanish")).toMatchObject({ kind: "reference", reason: "not-bundled" });
  });

  it("every bundled source is marked public domain, with evidence", () => {
    for (const s of Object.values(SCRIPTURE_SOURCES)) {
      expect(s.status).toMatch(/^Public domain/);
      expect(s.evidence).toMatch(/^https:\/\/ebible\.org\/[\w-]+\/copyright\.htm$/);
      expect(s.statement).toMatch(/Public Domain/);
    }
    expect(Object.keys(SCRIPTURE_SOURCES).sort()).toEqual(["ar", "de", "en", "es", "fr", "ko", "ru", "vi"]);
  });

  it("has no dashes in bundled text", () => {
    expect(JSON.stringify(data)).not.toMatch(/[\u2013\u2014]/);
  });

  it("dedupes references across blocks", () => {
    expect(referencesIn(["Hebrews 13:2", "Remember Hebrews 13:2!"])).toHaveLength(1);
  });
});

describe("verse checks on translations", () => {
  it("treats a verse reference as one fact, not loose numbers", () => {
    const facts = extractFacts("Hebrews 13:2 at 5:30 PM");
    expect(facts.map((f) => f.kind)).toEqual(["verse", "time"]);
  });

  it("passes when the translation keeps the reference numbers", () => {
    const f = flagBlock("Our theme is Hebrews 13:2.", "Nuestro tema es Hebreos 13:2.", null);
    expect(f.facts[0]).toMatchObject({ status: "ok", note: "Chapter and verse numbers kept" });
    expect(f.verseText).toBeNull();
  });

  it("flags a missing verse number", () => {
    const f = flagBlock("Our theme is Hebrews 13:2.", "Nuestro tema es Hebreos 13.", null);
    expect(f.facts[0].status).not.toBe("ok");
  });

  it("flags a translation that seems to write the verse out", () => {
    const src = "Our theme is Hebrews 13:2.";
    const long = "Nuestro tema es Hebreos 13:2: No olvidéis la hospitalidad, porque por ella algunos, sin saberlo, hospedaron ángeles. Y además recordemos que todos somos llamados a recibir al extranjero.";
    expect(addedVerseText(src, long)).toMatch(/did not write out the verse/);
    expect(flagBlock(src, long, null).problems).toBeGreaterThan(0);
    expect(addedVerseText("No verse here.", long)).toBeNull();
  });
});

const mk = (code: string, texts: string[]): PublishLanguage => {
  const l: PublishLanguage = { code, name: code, reviewer: "Ana Ruiz", blocks: texts.map((text) => ({ text, problems: 0, review: unapprove() })) };
  for (const b of l.blocks) {
    const r = approve(b, "Ana Ruiz", true);
    if (!r.ok) throw new Error(r.reason);
    b.review = r.review;
  }
  return l;
};

describe("exports with scripture", () => {
  const english = ["Dinner", "Our theme is Hebrews 13:2.", "Translated with AI help."];

  it("inserts the public-domain verse in the snippet and the email, and keeps reference-only languages clean", () => {
    const es = mk("es", ["Cena", "Nuestro tema es Hebreos 13:2.", "Traducido con ayuda de IA."]);
    const ht = mk("ht", ["Manje", "Tèm nou se Ebre 13:2.", "Tradui avèk èd IA."]);
    const html = webSnippet(english, [es, ht]);
    expect(html).toContain("(Reina-Valera 1909)</cite>");
    expect(html).toContain("(King James Version)</cite>");
    const htSection = html.slice(html.indexOf('lang="ht"'));
    expect(htSection).not.toContain("<blockquote");
    expect(htSection).toContain("Ebre 13:2");
    const mail = emailText(english, [es, ht]);
    expect(mail).toContain("Hebreos 13:2 (Reina-Valera 1909)");
    const f = flyer(english, [es, ht], "es");
    expect(f).toMatchObject({ title: "Cena", paragraphs: ["Nuestro tema es Hebreos 13:2."], disclosure: "Traducido con ayuda de IA.", reviewer: "Ana Ruiz" });
    expect(f.verses).toHaveLength(1);
    expect(flyer(english, [es, ht], "en")).toMatchObject({ title: "Dinner", disclosure: null, reviewer: null });
    expect(flyer(english, [es, ht], "ht").referenceOnly[0]).toMatchObject({ reason: "no-source" });
  });

  it("locks every flyer until every block of every language is approved", () => {
    const es = mk("es", ["Cena", "Nuestro tema es Hebreos 13:2.", "Traducido con ayuda de IA."]);
    const ht = mk("ht", ["Manje", "Tèm nou se Ebre 13:2.", "Tradui avèk èd IA."]);
    ht.blocks[1].review = unapprove();
    expect(() => flyer(english, [es, ht], "es")).toThrow(NotApproved);
    expect(() => flyer(english, [es, ht], "en")).toThrow(NotApproved);
    expect(() => webSnippet(english, [es, ht])).toThrow(NotApproved);
  });

  it("locks a flyer when an approved block is edited afterwards", () => {
    const es = mk("es", ["Cena", "Nuestro tema es Hebreos 13:2.", "Traducido con ayuda de IA."]);
    es.blocks[0].text = "Cena gratis";
    expect(() => flyer(english, [es], "es")).toThrow(NotApproved);
  });

  it("has no flyer for a language that is not in the announcement", () => {
    expect(() => flyer(english, [mk("es", ["Cena", "x", "y"])], "fr")).toThrow(NotApproved);
  });

  it("passagesFor returns nothing when no verse is cited", () => {
    expect(passagesFor(["Hello", "Lunch at noon"], "es")).toEqual([]);
  });
});
