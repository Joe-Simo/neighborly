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
import { droppedAt, fileProblem, inBatches, linesOf, readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";
import type { Words } from "@/lib/words";

type Checked = FunctionReturnType<typeof api.importExport.checkNeighbors>;
type Imported = FunctionReturnType<typeof api.importExport.importNeighbors>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

type ToolsWords = Words["rooms"]["tools"];
/** The sheet's own lines in the person's language. The sample file is made-up data and stays as it is. */
export const neighborWords = (text: ToolsWords["neighbors"]): SheetWords => ({
  id: "neighbors-import",
  title: text.title,
  deck: text.deck,
  fileHelp: text.fileHelp,
  sample: { fileName: "neighbors-sample.csv", text: "Name,Phone,Email,Address,Adults,Children,Language,Notes\nAlma Bellweather,(100) 555-0141,,\"18 Sample St, Apt 2\",2,3,English,Prefers a call after 3 PM\nBenito Castellanos,(100) 555-0142,benito.castellanos@sample.example,240 Example Ave,1,0,Spanish,\nMireille Desrosiers,(100) 555-0143,,7 Demo Ct,2,1,Creole,\n" },
  yes: text.yes,
  nothingReady: text.nothingReady,
  promise: text.promise,
  done: text.done,
  nothingDone: text.nothingDone,
});
/** A line with no name is known by the first thing it does have, read from the file on this device. */
export function neighborsLeftOut(rows: (Checked[number] | Imported[number])[], reasons: Record<Problem, string>, sheet: NeighborRow[]): LeftOut[] {
  const lines = new Map(sheet.map((row) => [row.line, row]));
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name || lines.get(row.line)?.phone || lines.get(row.line)?.address || "", reason: reasons[row.outcome] }]));
}

/** For the neighbors room. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function NeighborsImport() {
  const { data, words } = useWorkspace();
  const tools = words.rooms.tools;
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const convex = useConvex();
  const importNeighbors = useMutation(api.importExport.importNeighbors);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<NeighborRow[]>([]);
  if (!allowed) return null;
  return (
    <SheetImportView
      words={neighborWords(tools.neighbors)}
      state={state}
      icon={<FileInput size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: tools.sheet.reading });
        void file.text()
          .then(async (text) => {
            const sheet = readNeighborRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: fileProblem(sheet.error, tools.file), fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkNeighbors, { churchId, rows: batch }), (done) => setState({ step: "working", label: tools.sheet.reading, read: readSoFar(sheet.rows, tools.sheet), progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length, words) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: neighborsLeftOut(checked, tools.neighbors.reasons, sheet.rows) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: tools.sheet.unreadable }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: tools.neighbors.adding, saving: review });
        void inBatches(rows, mostRows, (batch) => importNeighbors({ churchId, rows: batch }), (done) => setState({ step: "working", label: tools.neighbors.adding, saving: review, progress: rows.length > mostRows ? linesOf(done, rows.length, words) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: tools.neighbors.notAdded });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: neighborsLeftOut(results, tools.neighbors.reasons, rows), error: finished ? undefined : droppedAt(results.length, rows.length, words) });
        });
      }}
    />
  );
}
