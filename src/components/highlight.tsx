import type { ReactNode } from "react";
import type { FactCheck } from "@/lib/checks";

type Range = { start: number; end: number; className: string; title: string };

/** Mark the facts the code checked, and the words that did not come back in the back-translation. */
export function HighlightedSource({ text, facts, drift }: { text: string; facts: FactCheck[]; drift: string[] }) {
  const ranges: Range[] = facts.map((c) => {
    const raw = c.fact.raw.replace(/[.,]$/, "");
    return { start: c.fact.index, end: c.fact.index + raw.length, className: `fact${c.status === "ok" ? "" : ` fact-${c.status}`}`, title: c.note };
  });
  for (const w of drift) {
    const re = new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!ranges.some((r) => start < r.end && end > r.start)) ranges.push({ start, end, className: "drift", title: "Not found in the back-translation. It may be fine, or the meaning may have shifted." });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start < at) return;
    if (r.start > at) out.push(text.slice(at, r.start));
    out.push(
      <mark key={i} className={r.className} title={r.title}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}
