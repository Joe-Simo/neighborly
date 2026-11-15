"use client";

import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FileInput } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readNeighborRows, type NeighborRow } from "@/components/workspace/tools/neighbor-rows";
import { SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";

type Checked = FunctionReturnType<typeof api.importExport.checkNeighbors>;
type Imported = FunctionReturnType<typeof api.importExport.importNeighbors>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

const reasons: Record<Problem, string> = {
  no_name: "The name is missing.",
  too_long: "One of the boxes on this line holds more than a record can keep.",
  bad_count: "Adults and children should be whole numbers, with at least one adult.",
  bad_language: "The language should be English, Spanish or Creole, or left empty.",
  repeated: "The same name or phone number is on an earlier line of this file.",
  same_phone: "A neighbor with this phone number is already on file.",
  same_name: "A neighbor with this name is already on file.",
};
const neighbors = (count: number) => (count === 1 ? "1 neighbor" : `${count} neighbors`);
export const neighborWords: SheetWords = {
  id: "neighbors-import",
  title: "Bring in your neighbor records",
  deck: "Moving over from paper or another system? Save your list as a CSV file and choose it here. Anyone already on file is left out, so no household is entered twice.",
  fileLabel: "Neighbors file",
  fileHelp: "It needs a Name column. Phone, Email, Address, Adults, Children, Language and Notes are taken when they are there.",
  yes: (count) => `Add ${neighbors(count)}`,
  nothingReady: "Nobody in this file can be added yet",
  promise: "Each becomes a private record, open to coordinators only. Nothing is saved until you say so.",
  done: (count) => `${neighbors(count)} added. Their records are in the neighbor list now.`,
  nothingDone: "Nobody new was added.",
  another: "Bring in another file",
};
export function neighborsLeftOut(rows: (Checked[number] | Imported[number])[]): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name, reason: reasons[row.outcome] }]));
}

/** For the neighbors room. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function NeighborsImport() {
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const convex = useConvex();
  const importNeighbors = useMutation(api.importExport.importNeighbors);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<NeighborRow[]>([]);
  if (!allowed) return null;
  return (
    <SheetImportView
      words={neighborWords}
      state={state}
      icon={<FileInput size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: "Reading your file" });
        void file.text()
          .then(async (text) => {
            const sheet = readNeighborRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error });
            const checked = await convex.query(api.importExport.checkNeighbors, { churchId, rows: sheet.rows });
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: neighborsLeftOut(checked) });
          })
          .catch(() => setState({ step: "choose", error: "That file could not be read. Nothing has changed; save the spreadsheet as CSV and choose it again." }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Adding the records" });
        void importNeighbors({ churchId, rows })
          .then((imported) => setState({ step: "done", done: imported.filter((row) => row.outcome === "added").length, leftOut: neighborsLeftOut(imported) }))
          .catch(() => setState({ ...review, error: "The records could not be added. Nothing was saved and your file is still here; try again." }));
      }}
    />
  );
}
