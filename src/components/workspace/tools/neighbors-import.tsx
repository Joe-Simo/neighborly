"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import type { FunctionReturnType } from "convex/server";
import { FileInput } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readNeighborRows, type NeighborRow } from "@/components/workspace/tools/neighbor-rows";
import { mostRows } from "@/components/workspace/tools/member-rows";
import { inBatches, linesOf, readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";

type Checked = FunctionReturnType<typeof api.importExport.checkNeighbors>;
type Imported = FunctionReturnType<typeof api.importExport.importNeighbors>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

const reasons: Record<Problem, string> = {
  no_name: "The name is missing.",
  too_long: "One of the boxes on this line holds more than a record can keep.",
  bad_count: "Adults and children should be whole numbers, with at least one adult.",
  repeated: "The same name or phone number is on an earlier line of this file.",
  same_phone: "A neighbor with this phone number is already on file.",
  same_name: "A neighbor with this name is already on file.",
};
const neighbors = (count: number) => (count === 1 ? "1 neighbor" : `${count.toLocaleString("en-US")} neighbors`);
export const neighborWords: SheetWords = {
  id: "neighbors-import",
  title: "Bring in your neighbor records",
  deck: "Moving over from paper or another system? Save your list as a CSV file and choose it here. Anyone already on file is left out, so no household is entered twice.",
  fileHelp: "It needs a Name column. Phone, Email, Address, Adults, Children, Language and Notes are taken when they are there.",
  sample: { fileName: "neighbors-sample.csv", text: "Name,Phone,Email,Address,Adults,Children,Language,Notes\nAlma Bellweather,(100) 555-0141,,\"18 Sample St, Apt 2\",2,3,English,Prefers a call after 3 PM\nBenito Castellanos,(100) 555-0142,benito.castellanos@sample.example,240 Example Ave,1,0,Spanish,\nMireille Desrosiers,(100) 555-0143,,7 Demo Ct,2,1,Creole,\n" },
  yes: (count) => `Add ${neighbors(count)}`,
  nothingReady: "Nobody in this file can be added yet",
  promise: "Each becomes a private record, open to coordinators only. Nothing is saved until you say so.",
  done: (count) => `${neighbors(count)} added. Their records are in the neighbor list now.`,
  nothingDone: "Nobody new was added.",
  another: "Choose another file",
};
/** A line with no name is known by the first thing it does have, read from the file on this device. */
export function neighborsLeftOut(rows: (Checked[number] | Imported[number])[], sheet: NeighborRow[]): LeftOut[] {
  const lines = new Map(sheet.map((row) => [row.line, row]));
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name || lines.get(row.line)?.phone || lines.get(row.line)?.address || "", reason: reasons[row.outcome] }]));
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
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error, fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkNeighbors, { churchId, rows: batch }), (done) => setState({ step: "working", label: "Reading your file", read: readSoFar(sheet.rows), progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: neighborsLeftOut(checked, sheet.rows) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: "That file could not be read. Nothing has changed; save the spreadsheet as CSV and choose it again." }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Adding the records", saving: review });
        void inBatches(rows, mostRows, (batch) => importNeighbors({ churchId, rows: batch }), (done) => setState({ step: "working", label: "Adding the records", saving: review, progress: rows.length > mostRows ? linesOf(done, rows.length) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: "The records could not be added. Nothing was saved and your file is still here; try again." });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: neighborsLeftOut(results, rows), error: finished ? undefined : `The connection dropped partway through. ${linesOf(results.length, rows.length)} were dealt with and are safe. Choose the same file again to finish; nothing is added twice.` });
        });
      }}
    />
  );
}
