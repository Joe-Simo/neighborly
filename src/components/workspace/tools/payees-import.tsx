"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Store } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { readPayeeRows, type PayeeRow } from "@/components/workspace/tools/payee-rows";
import { mostRows } from "@/components/workspace/tools/member-rows";
import { droppedAt, fileProblem, inBatches, linesOf, readSoFar, SheetImportView, useRecordsOffered, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";
import type { Words } from "@/lib/words";

type Checked = FunctionReturnType<typeof api.importExport.checkPayees>;
type Imported = FunctionReturnType<typeof api.importExport.importPayees>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "added">;

type ToolsWords = Words["rooms"]["tools"];
/** The sheet's own lines in the person's language. The sample file is made-up data and stays as it is. */
const payeeWords = (text: ToolsWords["payees"]): SheetWords => ({
  id: "payees-import",
  title: text.title,
  deck: text.deck,
  fileHelp: text.fileHelp,
  sample: { fileName: "payees-sample.csv", text: "Name,Type,Address,Phone,Email,Notes\nSample Street Apartments,Landlord,10 Sample St,(100) 555-0150,office@samplestreet.example,Ask for the office\nDemo Power & Light,Utility,,(100) 555-0151,,\nConference thrift store,Store,,,,Vouchers only\n" },
  yes: text.yes,
  nothingReady: text.nothingReady,
  promise: text.promise,
  done: text.done,
  nothingDone: text.nothingDone,
});
function payeesLeftOut(rows: (Checked[number] | Imported[number])[], reasons: Record<Problem, string>): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "added" ? [] : [{ line: row.line, name: row.name, reason: reasons[row.outcome] }]));
}

/** For the neighbors room, beside the other imports. Renders nothing for anyone who may not open neighbor records; the backend refuses them too. */
export function PayeesImport() {
  const { data, words } = useWorkspace();
  const tools = words.rooms.tools;
  const churchId = data.church.id;
  const allowed = useRecordsOffered();
  const convex = useConvex();
  const importPayees = useMutation(api.importExport.importPayees);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<PayeeRow[]>([]);
  if (!allowed) return null;
  return (
    <SheetImportView
      words={payeeWords(tools.payees)}
      state={state}
      icon={<Store size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: tools.sheet.reading });
        void file.text()
          .then(async (text) => {
            const sheet = readPayeeRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: fileProblem(sheet.error, tools.file), fileName: file.name });
            const { results: checked, finished } = await inBatches(sheet.rows, mostRows, (batch) => convex.query(api.importExport.checkPayees, { churchId, rows: batch }), (done) => setState({ step: "working", label: tools.sheet.reading, read: readSoFar(sheet.rows, tools.sheet), progress: sheet.rows.length > mostRows ? linesOf(done, sheet.rows.length, words) : undefined }));
            if (!finished) throw new Error("The check did not finish.");
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: payeesLeftOut(checked, tools.payees.reasons) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: tools.sheet.unreadable }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: tools.payees.adding, saving: review });
        void inBatches(rows, mostRows, (batch) => importPayees({ churchId, rows: batch }), (done) => setState({ step: "working", label: tools.payees.adding, saving: review, progress: rows.length > mostRows ? linesOf(done, rows.length, words) : undefined })).then(({ results, finished }) => {
          if (!finished && !results.length) return setState({ ...review, error: tools.payees.notAdded });
          setState({ step: "done", done: results.filter((row) => row.outcome === "added").length, leftOut: payeesLeftOut(results, tools.payees.reasons), error: finished ? undefined : droppedAt(results.length, rows.length, words) });
        });
      }}
    />
  );
}
