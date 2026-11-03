/**
 * A starter church glossary. Generic machine translation often picks a word a church would not use
 * (for example "comunión" where many Spanish-speaking Protestant churches say "Santa Cena"). Each church should have a fluent
 * member confirm or change these; the app treats them as the church's own choices, not as facts.
 */
export type GlossaryEntry = { term: string; note?: string; preferred: Partial<Record<string, string>> };

export const STARTER_GLOSSARY: GlossaryEntry[] = [
  { term: "worship service", preferred: { es: "culto", fr: "culte", pt: "culto", ht: "sèvis adorasyon", vi: "buổi thờ phượng", "zh-Hans": "崇拜", ko: "예배" } },
  { term: "small group", note: "A weekly group that meets in a home", preferred: { es: "grupo pequeño", fr: "petit groupe", pt: "pequeno grupo", ht: "ti gwoup", vi: "nhóm nhỏ", "zh-Hans": "小组", ko: "소그룹" } },
  { term: "communion", note: "The Lord's Supper", preferred: { es: "Santa Cena", fr: "Sainte Cène", pt: "Santa Ceia", ht: "Sentsèn", vi: "Tiệc Thánh", "zh-Hans": "圣餐", ko: "성찬" } },
  { term: "kids check-in", note: "Where parents sign children in for safety", preferred: { es: "registro de niños", fr: "accueil des enfants", "zh-Hans": "儿童签到" } },
  { term: "Bible study", preferred: { es: "estudio bíblico", fr: "étude biblique", pt: "estudo bíblico", ht: "etid biblik", vi: "học Kinh Thánh", "zh-Hans": "查经", ko: "성경공부" } },
  { term: "food pantry", preferred: { es: "despensa de alimentos", fr: "banque alimentaire", pt: "banco de alimentos", "zh-Hans": "食物银行" } },
  { term: "volunteer", preferred: { es: "voluntario", fr: "bénévole", pt: "voluntário", ht: "volontè", vi: "tình nguyện viên", "zh-Hans": "志愿者", ko: "자원봉사자" } },
  { term: "Grace Fellowship", note: "Church name: never translate", preferred: {} },
];

export const KEEP_AS_IS = ["Grace Fellowship"];

const fold = (s: string) => s.normalize("NFC").toLowerCase();

function mentions(text: string, term: string) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return new RegExp(`\\b${esc}(?:s|es)?\\b`, "i").test(text);
}

/** Allows plural and gender endings: "grupo pequeño" matches "grupos pequeños". */
export function usesTerm(translation: string, expected: string): boolean {
  const t = fold(translation);
  const words = fold(expected).split(/\s+/).filter(Boolean);
  if (words.length === 1) return t.includes(words[0]);
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(words.map(esc).join("\\S{0,3}\\s+(?:\\S+\\s+)?"), "u").test(t);
}

export type GlossaryHit = { term: string; expected: string; used: boolean };

/** Glossary terms in the English and whether the translation used the church's word for them. */
export function checkGlossary(source: string, translation: string, lang: string, glossary: GlossaryEntry[]): GlossaryHit[] {
  const out: GlossaryHit[] = [];
  for (const g of glossary) {
    if (!mentions(source, g.term)) continue;
    const keep = Object.keys(g.preferred).length === 0;
    const expected = keep ? g.term : g.preferred[lang];
    if (!expected) continue;
    out.push({ term: g.term, expected, used: usesTerm(translation, expected) });
  }
  return out;
}

/** The glossary lines the model sees for one language. */
export function glossaryForPrompt(source: string, lang: string, glossary: GlossaryEntry[]): string[] {
  return glossary
    .filter((g) => mentions(source, g.term))
    .map((g) => (Object.keys(g.preferred).length === 0 ? `"${g.term}": keep exactly as written` : g.preferred[lang] ? `"${g.term}": use "${g.preferred[lang]}"` : ""))
    .filter(Boolean);
}
