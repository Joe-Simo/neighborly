import { madeFrames } from "@/lib/made-frames";
import { evalTable } from "@/lib/made-proof";
import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";
import { CutHead } from "@/components/cut-heads";

const whole = new Intl.NumberFormat("en-US");
const sum = (key: "right" | "blank" | "wrong") => evalTable.fields.reduce((total, row) => total + row[key], 0);
// Counted from the run files, never typed: the frames of the Mac's scroll and the eval's held-out fields.
const counts: Record<string, string> = {
  frames1440: whole.format(madeFrames.widths.find((row) => row.width === "1440")?.frames ?? 0),
  frames390: whole.format(madeFrames.widths.find((row) => row.width === "390")?.frames ?? 0),
  right: whole.format(sum("right")), blank: whole.format(sum("blank")), wrong: whole.format(sum("wrong")),
  cells: whole.format(evalTable.notes * evalTable.fields.length),
};
const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => counts[key] ?? "");

/** The checks the page rests on, each with where it is recorded. A sheet like the others; nothing in it moves. */
export function MadeChecked({ said }: { said: (typeof madeWords)[Language]["checked"] }) {
  return <section className="public-made-checked">
    <CutHead>{said.title.replace(/ (\S+)$/, " $1")}</CutHead>
    <div>
      <ul>{said.items.map(({ lead, rest, source }) => <li key={source}>
        <p><strong>{fill(lead)}</strong> {fill(rest)}</p>
        <p className="public-made-checked-source">{source}</p>
      </li>)}</ul>
    </div>
  </section>;
}
