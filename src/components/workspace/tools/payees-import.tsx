"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { FunctionReturnType } from "convex/server";
import { Store } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readPayeeRows, type PayeeRow } from "@/components/workspace/tools/payee-rows";
import { mostRows } from "@/components/workspace/tools/member-rows";
import { inBatches, linesOf, readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";

type Checked = FunctionReturnType<typeof api.importExport.checkPayees>;
type Imported = FunctionReturnType<typeof api.importExport.importPayees>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

const reasons: Record<Problem, string> = {
  no_name: "The name is missing.",
  too_long: "One of the boxes on this line holds more than the list can keep.",
  repeated: "The same name is on an earlier line of this file.",
  already_here: "Already on your list.",
};
const payees = (count: number) => (count === 1 ? "1 payee" : `${count.toLocaleString("en-US")} payees`);
export const payeeWords: SheetWords = {
  id: "payees-import",
  title: "Bring in who you pay",
  deck: "The landlords, utilities and stores your conference already pays. Export the list from ServWare or another system, save it as CSV and choose it here, so nobody types a payee twice.",
  fileHelp: "It needs a Name column. Type, Address, Phone, Email and Notes are taken when they are there.",
  sample: { fileName: "payees-sample.csv", text: "Name,Type,Address,Phone,Email,Notes\nSample Street Apartments,Landlord,10 Sample St,(100) 555-0150,office@samplestreet.example,Ask for the office\nDemo Power & Light,Utility,,(100) 555-0151,,\nConference thrift store,Store,,,,Vouchers only\n" },
  yes: (count) => `Add ${payees(count)}`,
  nothingReady: "Nothing in this file can be added yet",
  promise: "Names and how to reach them only. No money and no account numbers come with the list. Nothing is saved until you say so.",
  done: (count) => `${payees(count)} added to your list.`,
  nothingDone: "Nothing new was added.",
  another: "Bring in another file",
};
export function payeesLeftOut(rows: (Checked[number] | Imported[number])[]): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name, reason: reasons[row.outcome] }]));
}

/** For the neighbors room, beside the other imports. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function PayeesImport() {
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const convex = useConvex();
  const importPayees = useMutation(api.importExport.importPayees);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<PayeeRow[]>([]);
  if (!allowed) return null;
  return (
    <SheetImportView
      words={payeeWords}
      state={state}
      icon={<Store size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: "Reading your file" });
        void file.text()
          .then(async (text) => {
            const sheet = readPayeeRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error, fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkPayees, { churchId, rows: batch }), (done) => setState({ step: "working", label: "Reading your file", read: readSoFar(sheet.rows), progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: payeesLeftOut(checked) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: "That file could not be read. Nothing has changed; save the spreadsheet as CSV and choose it again." }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Adding the list", saving: review });
        void inBatches(rows, mostRows, (batch) => importPayees({ churchId, rows: batch }), (done) => setState({ step: "working", label: "Adding the list", saving: review, progress: rows.length > mostRows ? linesOf(done, rows.length) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: "The list could not be added. Nothing was saved and your file is still here; try again." });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: payeesLeftOut(results), error: finished ? undefined : `The connection dropped partway through. ${linesOf(results.length, rows.length)} were dealt with and are safe. Choose the same file again to finish; nothing is added twice.` });
        });
      }}
    />
  );
}
