"use client";

import { useState } from "react";
import { useAction, useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, UserPlus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { invitationLinksCsv, readMemberRows, type MemberRow } from "@/components/workspace/tools/member-rows";

type Checked = FunctionReturnType<typeof api.importExport.checkMembers>;
type Imported = FunctionReturnType<typeof api.importExport.importMembers>;
type Outcome = (Checked[number] | Imported[number])["outcome"];
export type ImportStep =
  | { step: "choose"; error?: string }
  | { step: "working"; label: string }
  | { step: "review"; fileName: string; rows: MemberRow[]; checked: Checked; error?: string }
  | { step: "done"; results: Imported };

const reasons: Record<Exclude<Outcome, "ready" | "invited">, string> = {
  no_name: "The name is missing.",
  bad_email: "The email address is missing or not complete.",
  bad_role: "The role should be Member or Coordinator, or left empty.",
  repeated: "This email address is in the file twice.",
  already_member: "Already in your group.",
  already_invited: "Already has an invitation waiting.",
};
const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);

function Problems({ rows }: { rows: { line: number; name: string; email: string; outcome: Outcome }[] }) {
  const skipped = rows.filter((row) => row.outcome !== "ready" && row.outcome !== "invited");
  if (!skipped.length) return null;
  return (
    <div className="tools-problems">
      <div className="live-section-head">
        <h3>Left out</h3>
        <span className="live-count">{skipped.length === 1 ? "1 line" : `${skipped.length} lines`}</span>
      </div>
      <div className="live-list">
        {skipped.map((row) => (
          <div className="live-row" key={row.line}>
            <div className="live-row-main">
              <div className="live-meta"><span>Line {row.line}</span></div>
              <h3>{row.name || row.email || "Empty name"}</h3>
              <p>{reasons[row.outcome as keyof typeof reasons]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MembersImportView({ state, onFile, onInvite, onDownload, onReset }: { state: ImportStep; onFile: (file: File) => void; onInvite: () => void; onDownload: () => void; onReset: () => void }) {
  const ready = state.step === "review" ? state.checked.filter((row) => row.outcome === "ready").length : 0;
  const invited = state.step === "done" ? state.results.filter((row) => row.outcome === "invited").length : 0;
  return (
    <section className="live-section">
      <div className="live-section-head">
        <h2>Bring in your members</h2>
      </div>
      <p className="live-deck">
        Already keep your members in a spreadsheet? Save it as a CSV file and choose it here. Each person gets an invitation; nobody joins without their own yes.
      </p>
      {"error" in state && state.error && <div className="live-error" role="alert"><p>{state.error}</p></div>}
      {state.step === "choose" && (
        <div className="tools-file">
          <LiveField label="Members file" help="It needs a Name column and an Email column. A Role column is welcome: Member or Coordinator.">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onFile(file);
              }}
            />
          </LiveField>
        </div>
      )}
      {state.step === "working" && <LiveLoading label={state.label} />}
      {state.step === "review" && (
        <>
          <div className="live-note" role="status">
            <p>
              {ready ? `${people(ready)} in ${state.fileName} can be invited.` : `Nobody in ${state.fileName} can be invited yet.`}
              {state.checked.length > ready && ` ${state.checked.length - ready === 1 ? "1 line is" : `${state.checked.length - ready} lines are`} left out, listed below.`}
            </p>
          </div>
          <div className="tools-choices">
            {ready > 0 && <Button onClick={onInvite}><UserPlus size={16} aria-hidden="true" /> Invite {people(ready)}</Button>}
            <Button variant="outline" onClick={onReset}>Choose another file</Button>
          </div>
          <Problems rows={state.checked} />
        </>
      )}
      {state.step === "done" && (
        <>
          <div className="live-success" role="status">
            <p>
              {invited ? `${people(invited)} invited.` : "Nobody new was invited."}
              {invited > 0 && " Each invitation has a private link, good for seven days. Download the links to pass on yourself."}
            </p>
          </div>
          <div className="tools-choices">
            {invited > 0 && <Button onClick={onDownload}><Download size={16} aria-hidden="true" /> Download the links</Button>}
            <Button variant="outline" onClick={onReset}>Bring in another file</Button>
          </div>
          {invited > 0 && <p className="tools-small">The links are shown this once and are not kept. Download them before you leave this page.</p>}
          <Problems rows={state.results} />
        </>
      )}
    </section>
  );
}

export function MembersImport() {
  const { data, isOwner } = useWorkspace();
  const convex = useConvex();
  const importMembers = useAction(api.importExport.importMembers);
  const [state, setState] = useState<ImportStep>({ step: "choose" });
  if (!isOwner) return null;
  const churchId = data.church.id;
  return (
    <MembersImportView
      state={state}
      onReset={() => setState({ step: "choose" })}
      onFile={(file) => {
        setState({ step: "working", label: "Reading your file…" });
        void file.text()
          .then(async (text) => {
            const sheet = readMemberRows(text);
            if ("error" in sheet) return setState({ step: "choose", error: sheet.error });
            const checked = await convex.query(api.importExport.checkMembers, { churchId, rows: sheet.rows });
            setState({ step: "review", fileName: file.name, rows: sheet.rows, checked });
          })
          .catch(() => setState({ step: "choose", error: "We could not read that file. Save the spreadsheet as CSV and try again." }));
      }}
      onInvite={() => {
        if (state.step !== "review") return;
        const review = state;
        setState({ step: "working", label: "Creating the invitations…" });
        void importMembers({ churchId, batchId: crypto.randomUUID(), rows: review.rows })
          .then((results) => setState({ step: "done", results }))
          .catch(() => setState({ ...review, error: "The invitations could not be created. Nothing was sent; please try again." }));
      }}
      onDownload={() => {
        if (state.step !== "done") return;
        const links = state.results.flatMap((row) => (row.token ? [{ name: row.name, email: row.email, token: row.token }] : []));
        const url = URL.createObjectURL(new Blob([invitationLinksCsv(links, window.location.origin)], { type: "text/csv;charset=utf-8" }));
        const anchor = Object.assign(document.createElement("a"), { href: url, download: "invitation-links.csv" });
        anchor.click();
        URL.revokeObjectURL(url);
      }}
    />
  );
}
