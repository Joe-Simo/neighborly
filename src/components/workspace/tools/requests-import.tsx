"use client";

import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { History } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readRequestRows, type RequestRow } from "@/components/workspace/tools/request-rows";
import { mostRows } from "@/components/workspace/tools/member-rows";
import { inBatches, linesOf, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";

type Checked = FunctionReturnType<typeof api.importExport.checkRequests>;
type Imported = FunctionReturnType<typeof api.importExport.importRequests>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

const reasons: Record<Problem, string> = {
  no_name: "The name is missing.",
  no_neighbor: "This neighbor is not on file yet. Bring in the neighbors file first.",
  bad_date: "The request date should be a past day, written like 03/14/2026.",
  bad_amount: "The value should be an amount of money, like 125.00, or left empty.",
  bad_status: "The status should be Completed, Open or Call Back, or left empty.",
  too_long: "One of the boxes on this line holds more than a request can keep.",
  repeated: "The same request is on an earlier line of this file.",
  already_here: "Already brought in.",
};
const requests = (count: number) => (count === 1 ? "1 past request" : `${count.toLocaleString("en-US")} past requests`);
export const requestWords: SheetWords = {
  id: "requests-import",
  title: "Bring in your past requests",
  deck: "Moving over from ServWare or another system? Export your requests, save the file as CSV and choose it here. Each neighbor keeps their history, and your year\u2019s counts stay whole.",
  fileHelp: "It needs a name and a Request Date. Request Status, Assistance Type, Value, Payee and Request Notes are taken when they are there. Bring in the neighbors first.",
  sample: { fileName: "past-requests-sample.csv", text: "First Name,Last Name,Mobile Phone,Request Date,Request Status,Assistance Type,Value,Payee,Request Notes\nAlma,Bellweather,(100) 555-0141,03/14/2026,Completed,Rent,450.00,Sample Street Apartments,Short on rent after a medical bill\nBenito,Castellanos,(100) 555-0142,05/02/2026,Completed,Electric,86.50,Demo Power & Light,Shut-off notice\nMireille,Desrosiers,(100) 555-0143,09/21/2026,Open,Food,,,Call back about the pantry\n" },
  yes: (count) => `Add ${requests(count)}`,
  nothingReady: "Nothing in this file can be added yet",
  promise: "Each is kept as history on the neighbor\u2019s record. No money moves and the ledger is not touched. A request still open stays open only if it is under 60 days old. Nothing is saved until you say so.",
  done: (count) => `${requests(count)} added. See them on each neighbor\u2019s record.`,
  nothingDone: "Nothing new was added.",
  another: "Bring in another file",
};
export function requestsLeftOut(rows: (Checked[number] | Imported[number])[]): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name, reason: reasons[row.outcome] }]));
}

/** For the neighbors room, beside the neighbors import. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function RequestsImport() {
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const convex = useConvex();
  const importRequests = useMutation(api.importExport.importRequests);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<RequestRow[]>([]);
  if (!allowed) return null;
  return (
    <SheetImportView
      words={requestWords}
      state={state}
      icon={<History size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: "Reading your file" });
        void file.text()
          .then(async (text) => {
            const sheet = readRequestRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error, fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkRequests, { churchId, rows: batch }), (done) => setState({ step: "working", label: "Reading your file", progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: requestsLeftOut(checked) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: "That file could not be read. Nothing has changed; save the spreadsheet as CSV and choose it again." }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Adding the history" });
        void inBatches(rows, mostRows, (batch) => importRequests({ churchId, rows: batch }), (done) => setState({ step: "working", label: "Adding the history", progress: rows.length > mostRows ? linesOf(done, rows.length) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: "The requests could not be added. Nothing was saved and your file is still here; try again." });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: requestsLeftOut(results), error: finished ? undefined : `The connection dropped partway through. ${linesOf(results.length, rows.length)} were dealt with and are safe. Choose the same file again to finish; nothing is added twice.` });
        });
      }}
    />
  );
}
