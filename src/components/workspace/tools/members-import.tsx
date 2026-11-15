"use client";

import { useState } from "react";
import { useAction, useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, UserPlus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { readFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";
import { invitationLinksCsv, readMemberRows, type MemberRow } from "@/components/workspace/tools/member-rows";
import { readSoFar, SheetImportView, type LeftOut, type SheetStep, type SheetWords } from "@/components/workspace/tools/sheet-import";

type Checked = FunctionReturnType<typeof api.importExport.checkMembers>;
type Imported = FunctionReturnType<typeof api.importExport.importMembers>;
type Problem = Exclude<(Checked[number] | Imported[number])["outcome"], "ready" | "invited">;

const reasons: Record<Problem, string> = {
  no_name: "The name is missing.",
  bad_email: "The email address is missing or not complete.",
  bad_role: "The role should be Member or Coordinator, or left empty.",
  repeated: "This email address is in the file twice.",
  already_member: "Already in your group.",
  already_invited: "Already has an invitation waiting.",
};
const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);
export const memberWords: SheetWords = {
  id: "members-import",
  title: "Bring in your members",
  deck: "Already keep your members in a spreadsheet? Save it as a CSV file and choose it here. Each person gets an invitation; nobody joins without their own yes.",
  fileHelp: "It needs a Name column and an Email column. A Role column is welcome: Member or Coordinator.",
  sample: { fileName: "members-sample.csv", text: "Name,Email,Role\nMarisol Vega,marisol.vega@sample.example,Coordinator\nThomas Okafor,thomas.okafor@sample.example,Member\nRenee Baptiste,renee.baptiste@sample.example,\n" },
  yes: (count) => `Invite ${people(count)}`,
  nothingReady: "Nobody in this file can be invited yet",
  promise: "Each person gets a private link, good for seven days. Nothing is sent until you say so.",
  done: (count) => `${people(count)} invited. Download the private links to pass on yourself; they are shown this once and not kept.`,
  nothingDone: "Nobody new was invited.",
  another: "Bring in another file",
};
export function membersLeftOut(rows: (Checked[number] | Imported[number])[]): LeftOut[] {
  return rows.flatMap((row) => (row.outcome === "ready" || row.outcome === "invited" ? [] : [{ line: row.line, name: row.name || row.email, reason: reasons[row.outcome] }]));
}

export function MembersImport() {
  const { data, isOwner } = useWorkspace();
  const convex = useConvex();
  const importMembers = useAction(api.importExport.importMembers);
  const [state, setState] = useState<SheetStep>({ step: "choose" });
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [results, setResults] = useState<Imported>([]);
  if (!isOwner) return null;
  const churchId = data.church.id;
  return (
    <SheetImportView
      words={memberWords}
      state={state}
      icon={<UserPlus size={18} aria-hidden="true" />}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: "Reading your file" });
        void file.text()
          .then(async (text) => {
            const sheet = readMemberRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error, fileName: file.name });
            setState({ step: "working", label: "Reading your file", read: readSoFar(sheet.rows) });
            const checked = await convex.query(api.importExport.checkMembers, { churchId, rows: sheet.rows });
            setRows(sheet.rows);
            setState({ step: "review", fileName: file.name, ready: checked.filter((row) => row.outcome === "ready").length, leftOut: membersLeftOut(checked) });
          })
          .catch(() => setState({ step: "choose", fileName: file.name, error: "That file could not be read. Nothing has changed; save the spreadsheet as CSV and choose it again." }));
      }}
      onYes={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Creating the invitations", saving: review });
        void importMembers({ churchId, batchId: crypto.randomUUID(), rows })
          .then((imported) => {
            setResults(imported);
            setState({ step: "done", done: imported.filter((row) => row.outcome === "invited").length, leftOut: membersLeftOut(imported) });
          })
          .catch((cause: unknown) => setState({ ...review, error: readFailure(cause, "The invitations could not be created. Nobody was invited and your file is still here; try again.") }));
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
          <Download size={18} aria-hidden="true" /> Download the links
        </Button>
      }
    />
  );
}
