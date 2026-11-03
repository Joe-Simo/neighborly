import { describe, expect, it } from "vitest";
import { approve, blockState, exportGate, type LanguageReview, unapprove } from "@/lib/approval";
import { emailText, NotApproved, webSnippet } from "@/lib/publish";

const lang = (texts: string[], problems: number[] = []): LanguageReview & { reviewer: string } => ({
  code: "es",
  name: "Spanish",
  reviewer: "Ana",
  blocks: texts.map((text, i) => ({ text, problems: problems[i] ?? 0, review: { status: "pending" } })),
});

const approveAll = (l: ReturnType<typeof lang>) => {
  for (const b of l.blocks) {
    const r = approve(b, "Ana", true);
    if (!r.ok) throw new Error(r.reason);
    b.review = r.review;
  }
  return l;
};

describe("approval gating", () => {
  it("blocks export until every block of every language is approved", () => {
    const es = lang(["Hola", "Culto a las 10:30"]);
    expect(exportGate([es]).ready).toBe(false);
    const r = approve(es.blocks[0], "Ana", false);
    expect(r.ok).toBe(true);
    if (r.ok) es.blocks[0].review = r.review;
    const g = exportGate([es]);
    expect(g).toMatchObject({ ready: false, approved: 1, total: 2 });
    expect(g.waiting).toEqual([{ code: "es", name: "Spanish", block: 1, state: "pending" }]);
    approveAll(es);
    expect(exportGate([es]).ready).toBe(true);
  });

  it("needs a reviewer name", () => {
    expect(approve(lang(["Hola"]).blocks[0], "  ", false)).toEqual({ ok: false, reason: "Add the reviewer's name first." });
  });

  it("needs the flags ticked when a block has problems", () => {
    const b = lang(["Culto a las 11:30"], [1]).blocks[0];
    expect(approve(b, "Ana", false).ok).toBe(false);
    expect(approve(b, "Ana", true).ok).toBe(true);
  });

  it("sends a block back to pending when its text changes after approval", () => {
    const es = approveAll(lang(["Hola", "Adiós"]));
    expect(exportGate([es]).ready).toBe(true);
    es.blocks[1].text = "Adiós amigos";
    expect(blockState(es.blocks[1])).toBe("stale");
    expect(exportGate([es]).ready).toBe(false);
    es.blocks[1].review = unapprove();
    expect(blockState(es.blocks[1])).toBe("pending");
  });

  it("never treats zero languages as ready", () => {
    expect(exportGate([]).ready).toBe(false);
  });

  it("refuses to build exports until approved, then escapes HTML and sets lang", () => {
    const english = ["Join us", "Sunday <b>10:30</b>", "AI note"];
    const es = lang(["Acompáñenos", "Domingo <b>10:30</b>", "Nota de IA"]);
    expect(() => webSnippet(english, [es])).toThrow(NotApproved);
    expect(() => emailText(english, [es])).toThrow(NotApproved);
    approveAll(es);
    const html = webSnippet(english, [es]);
    expect(html).toContain('<section lang="es" dir="ltr"');
    expect(html).toContain("Domingo &lt;b&gt;10:30&lt;/b&gt;");
    expect(html).not.toContain("AI note");
    const mail = emailText(english, [es]);
    expect(mail.startsWith("Subject: Join us / Acompáñenos")).toBe(true);
    expect(mail).toContain("Nota de IA");
  });
});
