import { exportGate, type ReviewBlock, type Review } from "./approval";
import type { NeighborhoodLanguages } from "./census";
import { type BlockFlags, flagBlock } from "./checks";
import { checkGlossary, type GlossaryEntry, type GlossaryHit, STARTER_GLOSSARY } from "./glossary";
import { textHash } from "./hash";
import { languageByCode } from "./languages";
import { SAMPLE_CHURCH, SAMPLES, toBlocks } from "./samples";

export type BlockDraft = {
  ai: string;
  text: string;
  back: string | null;
  /** Hash of the text the back-translation was made from. */
  backFor: string | null;
  review: Review;
  flagsChecked: boolean;
};

export type LangDraft = {
  code: string;
  status: "idle" | "loading" | "ready" | "error";
  /** While loading: "queued" until the request starts, then what the server says it is doing. */
  phase?: "queued" | "translating" | "back-translating";
  startedAt?: number;
  error?: string;
  origin?: "live" | "cache" | "recorded";
  model?: string;
  generatedAt?: string;
  notice?: string;
  reviewer: string;
  /** The English blocks this translation was made from. */
  from: string[];
  blocks: BlockDraft[];
};

export type Workspace = {
  zip: string;
  neighborhood: NeighborhoodLanguages | null;
  selected: string[];
  sampleId: string | null;
  title: string;
  body: string;
  glossary: GlossaryEntry[];
  langs: Record<string, LangDraft>;
};

export const STORAGE_KEY = "neighborly:v1";

export function initialWorkspace(): Workspace {
  const s = SAMPLES[0];
  return { zip: SAMPLE_CHURCH.zip, neighborhood: null, selected: [], sampleId: s.id, title: s.title, body: s.body, glossary: STARTER_GLOSSARY, langs: {} };
}

export function loadWorkspace(): Workspace {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return initialWorkspace();
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    const base = initialWorkspace();
    const langs = Object.fromEntries(
      Object.entries(parsed.langs ?? {}).map(([k, l]) => [k, l.status === "loading" ? { ...l, status: "idle" as const } : l]),
    );
    return { ...base, ...parsed, langs };
  } catch {
    return initialWorkspace();
  }
}

export function saveWorkspace(w: Workspace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch {
    // Storage full or blocked: the workspace still works for this visit.
  }
}

export type BlockView = {
  source: string;
  flags: BlockFlags;
  glossary: GlossaryHit[];
  backCurrent: boolean;
  problems: number;
};

export function viewBlock(source: string, b: BlockDraft, code: string, glossary: GlossaryEntry[]): BlockView {
  const backCurrent = !!b.back && b.backFor === textHash(b.text);
  const flags = flagBlock(source, b.text, backCurrent ? b.back : null);
  const g = checkGlossary(source, b.text, code, glossary);
  return { source, flags, glossary: g, backCurrent, problems: flags.problems + g.filter((x) => !x.used).length + (backCurrent ? 0 : 1) };
}

export function sameBlocks(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Review blocks for the export gate. A translation made from older English counts as not approved. */
export function toReview(l: LangDraft, source: string[], glossary: GlossaryEntry[], name: string): { code: string; name: string; reviewer: string; blocks: ReviewBlock[] } {
  const fresh = sameBlocks(l.from, source);
  return {
    code: l.code,
    name,
    reviewer: l.reviewer,
    blocks: l.blocks.map((b, i) => ({
      text: b.text,
      problems: viewBlock(source[i] ?? "", b, l.code, glossary).problems,
      review: fresh ? b.review : { status: "pending" },
    })),
  };
}

/** The export gate for a whole workspace. The publish step and the flyer page share it, so neither can skip a check. */
export function publishState(w: Workspace) {
  const source = toBlocks(w.title, w.body);
  const active = w.selected.map((c) => w.langs[c]).filter(Boolean);
  const nameOf = (code: string) => languageByCode(code)?.name ?? code;
  const reviews = active.filter((l) => l.status === "ready").map((l) => toReview(l, source, w.glossary, nameOf(l.code)));
  const gate = exportGate(
    active.map((l) =>
      l.status === "ready" ? toReview(l, source, w.glossary, nameOf(l.code)) : { code: l.code, name: nameOf(l.code), reviewer: l.reviewer, blocks: [{ text: "", problems: 0, review: { status: "pending" as const } }] },
    ),
  );
  const blockedReason = !active.length ? "Pick at least one language in step 1." : active.some((l) => l.status !== "ready") ? "Translate every selected language first." : null;
  return { source, active, reviews, gate, blockedReason, ready: gate.ready && !blockedReason };
}
