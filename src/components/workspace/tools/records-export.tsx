"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { CircleCheck, Download, FolderDown } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { recordFiles, recordsCsv, recordsFileName, type RecordFileKey } from "@/components/workspace/tools/records";

export type GatheredFile = { key: RecordFileKey; title: string; fileName: string; lines: number; csv: string };
export type RecordsStep =
  | { step: "ready"; error?: string }
  | { step: "working"; progress: string }
  | { step: "done"; files: GatheredFile[] };

/**
 * The way out. One yes gathers the conference's own records into six spreadsheets on this device.
 * Nothing is sent anywhere, and each file uses the column names the imports read, so it can come back in.
 */
export function RecordsExportView({ state, onGather, onDownload, onReset }: { state: RecordsStep; onGather: () => void; onDownload: (file: GatheredFile) => void; onReset: () => void }) {
  return (
    <section className="live-section">
      <div className="live-section-head">
        <h2>Take your records with you</h2>
      </div>
      <p className="live-deck">
        Your conference’s records are yours. Download them as spreadsheets whenever you like: to keep, to print, or to move. They go to this device only; nothing is sent anywhere.
      </p>
      {"error" in state && state.error && <div className="live-error" role="alert"><p>{state.error}</p></div>}
      {state.step === "ready" && (
        <div className="tools-file">
          <div className="help-actions">
            <Button onClick={onGather}><FolderDown size={18} aria-hidden="true" /> Gather my records</Button>
          </div>
          <p className="tools-small">
            Six files: neighbors, requests and their outcomes, home visits, the ledger, who you pay, and members. Account numbers show their last four digits only. Each time, it is written down who took the records out.
          </p>
        </div>
      )}
      {state.step === "working" && (
        <>
          <div className="help-skeleton" aria-hidden="true">
            <div><i /><span><b /><b /></span></div>
            <div><i /><span><b /><b /></span></div>
          </div>
          <p role="status" className="tools-progress">{state.progress}</p>
        </>
      )}
      {state.step === "done" && (
        <>
          <div className="live-success help-done tools-done" role="status" tabIndex={-1} ref={(node) => node?.focus()}>
            <CircleCheck size={22} aria-hidden="true" />
            <span>Your records are ready on this device. Keep the files somewhere safe: they hold your neighbors’ private details.</span>
          </div>
          <div className="live-list tools-records">
            {state.files.map((file) => (
              <div className="help-row" data-quiet={file.lines ? undefined : ""} key={file.key}>
                <div className="live-date-leaf">
                  <span>{file.lines === 1 ? "Line" : "Lines"}</span>
                  <strong>{file.lines.toLocaleString("en-US")}</strong>
                </div>
                <div>
                  <h3>{file.title}</h3>
                  <p>{file.lines ? file.fileName : "Nothing here yet."}</p>
                </div>
                {file.lines > 0 && (
                  <Button variant="outline" aria-label={`Download ${file.title}`} onClick={() => onDownload(file)}>
                    <Download size={18} aria-hidden="true" /> Download
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="help-actions tools-after">
            <Button variant="ghost" onClick={onReset}>Put these away</Button>
          </div>
        </>
      )}
    </section>
  );
}

export function RecordsExport() {
  const { data, isOwner } = useWorkspace();
  const convex = useConvex();
  const recordExport = useMutation(api.importExport.recordExport);
  const [state, setState] = useState<RecordsStep>({ step: "ready" });
  if (!isOwner) return null;
  const churchId = data.church.id;
  const gather = async () => {
    await recordExport({ churchId });
    const files: GatheredFile[] = [];
    for (const file of recordFiles) {
      const rows: string[][] = [];
      let columns: string[] = [], cursor: string | null = null, done = false;
      while (!done) {
        setState({ step: "working", progress: `Gathering ${file.gathering}.${rows.length ? ` ${rows.length.toLocaleString("en-US")} lines so far.` : ""}` });
        const page: { columns: string[]; rows: string[][]; cursor: string; done: boolean } = await convex.query(api.importExport.exportPage, { churchId, file: file.key, cursor });
        rows.push(...page.rows);
        ({ columns, cursor, done } = page);
      }
      files.push({ key: file.key, title: file.title, fileName: recordsFileName(file.key, data.church.sample), lines: rows.length, csv: recordsCsv(columns, rows) });
    }
    setState({ step: "done", files });
  };
  return (
    <RecordsExportView
      state={state}
      onReset={() => setState({ step: "ready" })}
      onGather={() => void gather().catch(() => setState({ step: "ready", error: "The connection dropped while gathering. Nothing was lost or changed; try again." }))}
      onDownload={(file) => {
        const url = URL.createObjectURL(new Blob([file.csv], { type: "text/csv;charset=utf-8" }));
        Object.assign(document.createElement("a"), { href: url, download: file.fileName }).click();
        URL.revokeObjectURL(url);
      }}
    />
  );
}
