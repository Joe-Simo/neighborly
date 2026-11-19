"use client";

import { useState } from "react";
import { useAction, useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, UserPlus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { sayFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";
import { invitationLinksCsv, readMemberRows, type MemberRow } from "@/components/workspace/tools/member-rows";
import { fileProblem, readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";
import type { Words } from "@/lib/words";

type Checked = FunctionReturnType<typeof api.importExport.checkMembers>;
type Imported = FunctionReturnType<typeof api.importExport.importMembers>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "invited">;

type ToolsWords = Words["rooms"]["tools"];
/** The sheet's own lines in the person's language. The sample file is made-up data and stays as it is. */
const memberWords = (text: ToolsWords["members"]): SheetWords => ({
  id: "members-import",
  title: text.title,
  deck: text.deck,
  fileHelp: text.fileHelp,
  sample: { fileName: "members-sample.csv", text: "Name,Email,Role\nMarisol Vega,marisol.vega@sample.example,Coordinator\nThomas Okafor,thomas.okafor@sample.example,Member\nRenee Baptiste,renee.baptiste@sample.example,\n" },
  yes: text.yes,
  nothingReady: text.nothingReady,
  promise: text.promise,
  done: text.done,
  nothingDone: text.nothingDone,
});
function membersLeftOut(rows: (Checked[number] | Imported[number])[], reasons: Record<Problem, string>): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "invited" ? [] : [{ line: row.line, name: row.name || row.email, reason: reasons[row.outcome] }]));
}

export function MembersImport() {
  const { data, isOwner, words } = useWorkspace();
  const tools = words.rooms.tools;
  const convex = useConvex();
  const importMembers = useAction(api.importExport.importMembers);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [results, setResults] = useState<Imported>([]);
  if (!isOwner) return null;
  const churchId = data.church.id;
  return (
    <SheetImportView
      words={memberWords(tools.members)}
      state={state}
      icon={<UserPlus size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: tools.sheet.reading });
        void file.text()
          .then(async (text) => {
            const sheet = readMemberRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: fileProblem(sheet.error, tools.file), fileName: file.name });
            setState({ step: "working", label: tools.sheet.reading, read: readSoFar(sheet.rows, tools.sheet) });
            const checked = await convex.query(api.importExport.checkMembers, { churchId, rows: sheet.rows });
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: membersLeftOut(checked, tools.members.reasons) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: tools.sheet.unreadable }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: tools.members.adding, saving: review });
        void importMembers({ churchId, batchId: crypto.randomUUID(), rows })
          .then((imported) => {
            setResults(imported);
            setState({ step: "done", done: imported.filter((row) => row.outcome === "invited").length, leftOut: membersLeftOut(imported, tools.members.reasons) });
          })
          .catch((cause: unknown) => setState({ ...review, error: sayFailure(words.notices,cause, tools.members.notAdded, words.states.offlineSave) }));
      }}
      afterDone={
        <Button
          onClick={() => {
            const links = results.flatMap((row) => (row.token ? [{ name: row.name, email: row.email, token: row.token }] : []));
            const url = URL.createObjectURL(new Blob([invitationLinksCsv(links, window.location.origin)], { type: "text/csv;charset=utf-8" }));
            Object.assign(document.createElement("a"), { href: url, download: data.church.sample ? "sample-invitation-links.csv" : "invitation-links.csv" }).click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={18} aria-hidden="true" /> {tools.members.downloadLinks}
        </Button>
      }
    />
  );
}
