import { textHash } from "./hash";

/**
 * The human-in-the-loop rule, in one place: nothing exports until a named, fluent reviewer has approved every block
 * of every language, and an approval only counts for the exact text that was approved. Editing a block after approval
 * sends it back to pending. A block with open flags also needs the reviewer to tick that they checked them.
 */

export type Review = {
  status: "pending" | "approved";
  reviewer?: string;
  approvedHash?: string;
  approvedAt?: string;
  flagsChecked?: boolean;
};

export type ReviewBlock = { text: string; problems: number; review: Review };

export type LanguageReview = { code: string; name: string; blocks: ReviewBlock[] };

export type BlockState = "approved" | "pending" | "stale" | "needs-flag-check";

export function blockState(b: ReviewBlock): BlockState {
  if (b.review.status !== "approved") return "pending";
  if (b.review.approvedHash !== textHash(b.text)) return "stale";
  if (b.problems > 0 && !b.review.flagsChecked) return "needs-flag-check";
  if (!b.review.reviewer?.trim()) return "pending";
  return "approved";
}

export type ApproveResult = { ok: true; review: Review } | { ok: false; reason: string };

export function approve(b: ReviewBlock, reviewer: string, flagsChecked: boolean, now = new Date()): ApproveResult {
  const name = reviewer.trim();
  if (!name) return { ok: false, reason: "Add the reviewer's name first." };
  if (!b.text.trim()) return { ok: false, reason: "This block is empty." };
  if (b.problems > 0 && !flagsChecked) return { ok: false, reason: "Tick that you checked the flagged items." };
  return { ok: true, review: { status: "approved", reviewer: name, approvedHash: textHash(b.text), approvedAt: now.toISOString(), flagsChecked: b.problems > 0 ? true : flagsChecked } };
}

export const unapprove = (): Review => ({ status: "pending" });

export type Gate = {
  ready: boolean;
  approved: number;
  total: number;
  waiting: { code: string; name: string; block: number; state: Exclude<BlockState, "approved"> }[];
};

export function exportGate(languages: LanguageReview[]): Gate {
  const waiting: Gate["waiting"] = [];
  let approved = 0;
  let total = 0;
  for (const lang of languages) {
    lang.blocks.forEach((b, i) => {
      total++;
      const s = blockState(b);
      if (s === "approved") approved++;
      else waiting.push({ code: lang.code, name: lang.name, block: i, state: s });
    });
  }
  return { ready: languages.length > 0 && total > 0 && waiting.length === 0, approved, total, waiting };
}
