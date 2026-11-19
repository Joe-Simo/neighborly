"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import type { FunctionReturnType } from "convex/server";
import { History } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readRequestRows, type RequestRow } from "@/components/workspace/tools/request-rows";
import { mostRows } from "@/components/workspace/tools/member-rows";
import { droppedAt, fileProblem, inBatches, linesOf, readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";
import type { Words } from "@/lib/words";

type Checked = FunctionReturnType<typeof api.importExport.checkRequests>;
type Imported = FunctionReturnType<typeof api.importExport.importRequests>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

type ToolsWords = Words["rooms"]["tools"];
/** The sheet's own lines in the person's language. The sample file is made-up data and stays as it is. */
export const requestWords = (text: ToolsWords["requests"]): SheetWords => ({
  id: "requests-import",
  title: text.title,
  deck: text.deck,
  fileHelp: text.fileHelp,
  sample: { fileName: "past-requests-sample.csv", text: "First Name,Last Name,Mobile Phone,Request Date,Request Status,Assistance Type,Value,Payee,Request Notes\nAlma,Bellweather,(100) 555-0141,03/14/2026,Completed,Rent,450.00,Sample Street Apartments,Short on rent after a medical bill\nBenito,Castellanos,(100) 555-0142,05/02/2026,Completed,Electric,86.50,Demo Power & Light,Shut-off notice\nMireille,Desrosiers,(100) 555-0143,09/21/2026,Open,Food,,,Call back about the pantry\n" },
  yes: text.yes,
  nothingReady: text.nothingReady,
  promise: text.promise,
  done: text.done,
  nothingDone: text.nothingDone,
});
export function requestsLeftOut(rows: (Checked[number] | Imported[number])[], reasons: Record<Problem, string>): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name, reason: reasons[row.outcome] }]));
}

/** For the neighbors room, beside the neighbors import. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function RequestsImport() {
  const { data, words } = useWorkspace();
  const tools = words.rooms.tools;
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const convex = useConvex();
  const importRequests = useMutation(api.importExport.importRequests);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<RequestRow[]>([]);
  // While the answer is on its way the leaf keeps its place, unseen, so nothing below it moves when it arrives.
  if (allowed === false) return null;
  return (
    <SheetImportView
      holding={allowed === undefined}
      words={requestWords(tools.requests)}
      state={state}
      icon={<History size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: tools.sheet.reading });
        void file.text()
          .then(async (text) => {
            const sheet = readRequestRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: fileProblem(sheet.error, tools.file), fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkRequests, { churchId, rows: batch }), (done) => setState({ step: "working", label: tools.sheet.reading, read: readSoFar(sheet.rows, tools.sheet), progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length, words) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: requestsLeftOut(checked, tools.requests.reasons) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: tools.sheet.unreadable }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: tools.requests.adding, saving: review });
        void inBatches(rows, mostRows, (batch) => importRequests({ churchId, rows: batch }), (done) => setState({ step: "working", label: tools.requests.adding, saving: review, progress: rows.length > mostRows ? linesOf(done, rows.length, words) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: tools.requests.notAdded });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: requestsLeftOut(results, tools.requests.reasons), error: finished ? undefined : droppedAt(results.length, rows.length, words) });
        });
      }}
    />
  );
}
