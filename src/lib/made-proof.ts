import run7 from "../../eval/jev/run-7.json";
import { jevSet } from "./jev-set";

/** A field the assistant fills on a draft, in the order the draft shows them. */
export const evalFields = ["kind", "amount", "payeeKind", "signs"] as const;
type Field = (typeof evalFields)[number];
type Mark = "right" | "blank" | "wrong";

const fresh = new Set(jevSet.filter((note) => note.fresh).map((note) => note.id));
const rows = run7.rows.filter((row) => fresh.has(row.id));

/** The held-out notes of the last measure run, counted field by field from the run's own file, the screens' way ("mix"). */
export const evalTable = {
  run: 7,
  day: "2026-11-19",
  model: run7.model,
  notes: rows.length,
  fields: evalFields.map((field) => {
    const marks = rows.map((row) => (row.mix as Record<Field, Mark>)[field]);
    return { field, right: marks.filter((m) => m === "right").length, blank: marks.filter((m) => m === "blank").length, wrong: marks.filter((m) => m === "wrong").length };
  }),
};
