"use client";

import "./tools.css";
import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { strToU8, zipSync } from "fflate";
import { CircleCheck, Download, FolderDown } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveFailure } from "@/components/workspace/states";
import { readFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";
import { CountUp } from "@/components/workspace/primitives";
import { recordFiles, recordsCover, recordsCoverName, recordsCsv, recordsFileName, recordsZipName, type RecordFileKey } from "@/components/workspace/tools/records";

export type GatheredFile = { key: RecordFileKey; title: string; fileName: string; lines: number; csv: string };
export type RecordsStep =
  | { step: "ready"; error?: string }
  | { step: "working"; progress: string; files: GatheredFile[] }
  | { step: "done"; files: GatheredFile[] };

/**
 * The way out. One yes gathers the conference's own records into spreadsheets on this device, one for each kind of record.
 * Nothing is sent anywhere, and each file uses the column names the imports read, so it can come back in.
 */
const count = (amount: number) => Math.round(amount).toLocaleString("en-US");

function FileRows({ files, onDownload }: { files: GatheredFile[]; onDownload?: (file: GatheredFile) => void }) {
  return files.map((file) => (
    <div className="help-row" data-quiet={file.lines ? undefined : ""} key={file.key}>
      <div className="live-date-leaf">
        <span>{file.lines === 1 ? "Line" : "Lines"}</span>
        <strong><CountUp value={file.lines} format={count} /></strong>
      </div>
      <div>
        <h3>{file.title}</h3>
        <p>{file.lines ? file.fileName : "Nothing here yet."}</p>
      </div>
      {onDownload && file.lines > 0 && (
        <Button variant="link" className="tools-one" aria-label={`Download this file: ${file.title}`} onClick={() => onDownload(file)}>
          Download this file
        </Button>
      )}
    </div>
  ));
}

/**
 * The way out. One yes gathers the conference's own records into spreadsheets on this device, one for each kind of record.
 * Nothing is sent anywhere, and each file uses the column names the imports read, so it can come back in.
 */
export function RecordsExportView({ state, onGather, onDownloadAll, onDownload, onReset }: { state: RecordsStep; onGather: () => void; onDownloadAll: (files: GatheredFile[]) => void; onDownload: (file: GatheredFile) => void; onReset: () => void }) {
  // The one download always holds the whole set: a kind with nothing in it yet goes along with its headings only, so the folder, the cover and this list agree.
  const filled = state.step === "done" ? state.files.filter((file) => file.lines > 0) : [];
  const [lifted, setLifted] = useState(0);
  return (
    <section className={`tools-leaf tools-leaf-wide paper-corner${state.step === "done" ? " paper-fold" : ""}`} data-open={state.step === "ready" ? undefined : ""} aria-labelledby="records-export-name">
      <h2 id="records-export-name">Take your records with you</h2>
      <p className="tools-leaf-deck">
        Your conference’s records are yours. Download them as spreadsheets whenever you like: to keep, to print, or to move. They go to this device only; nothing is sent anywhere.
      </p>
      {"error" in state && state.error && <LiveFailure message={state.error} kept="" />}
      {state.step === "ready" && (
        <div className="tools-file">
          <div className="help-actions">
            <Button onClick={onGather}><FolderDown size={18} aria-hidden="true" /> Gather my records</Button>
          </div>
          <p className="tools-small">
            Everything your conference has written here, one file for each kind of record: the neighbors and their notes, calls, requests and visits; the ledger, deposits and vouchers; your members, teams and commitments. Account numbers show their last four digits only. Each time, it is written down who took the records out.
          </p>
        </div>
      )}
      {state.step === "working" && (
        <>
          <div className="live-list tools-records" aria-hidden="true">
            <FileRows files={state.files} />
          </div>
          <p role="status" className="tools-progress">{state.progress}</p>
        </>
      )}
      {state.step === "done" && (
        <>
          <div className="live-success help-done tools-done" role="status" tabIndex={-1} ref={(node) => node?.focus()}>
            <CircleCheck size={22} aria-hidden="true" />
            <span>Your records are ready on this device. Keep the files somewhere safe: they hold your neighbors’ private details. The download adds a cover sheet that lists every file.</span>
          </div>
          {filled.length > 0 && (
            <div className="help-actions tools-after tools-bundle-line">
              <span className="tools-bundle" key={lifted} data-lifted={lifted ? "" : undefined} aria-hidden="true"><i /><i /><i /></span>
              <Button onClick={() => { setLifted((times) => times + 1); onDownloadAll(state.files); }}>
                <Download size={18} aria-hidden="true" /> Download all {state.files.length} files
              </Button>
            </div>
          )}
          <div className="live-list tools-records">
            <FileRows files={state.files} onDownload={onDownload} />
          </div>
          <div className="help-actions tools-after">
            <Button variant="outline" onClick={onReset}>Put these away</Button>
          </div>
        </>
      )}
    </section>
  );
}

function save(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

/** One of the site's own typefaces as a data address, so a page can carry it. */
const face = (name: string) =>
  fetch(`/fonts/${name}.woff2`)
    .then((reply) => (reply.ok ? reply.blob() : Promise.reject(new Error("No typeface."))))
    .then((file) => new Promise<string>((done, failed) => {
      const reader = new FileReader();
      reader.onload = () => done(String(reader.result));
      reader.onerror = failed;
      reader.readAsDataURL(file);
    }))
    .catch(() => undefined);

export function RecordsExport() {
  const { data, isOwner, format } = useWorkspace();
  const convex = useConvex();
  const recordExport = useMutation(api.importExport.recordExport);
  const [state, setState] = useState<RecordsStep>({ step: "ready" });
  if (!isOwner) return null;
  const churchId = data.church.id;
  const gather = async () => {
    await recordExport({ churchId });
    const files: GatheredFile[] = [];
    for (const [index, file] of recordFiles.entries()) {
      const rows: string[][] = [];
      let columns: string[] = [], cursor: string | null = null, done = false;
      while (!done) {
        setState({ step: "working", files: [...files], progress: `Gathering ${file.gathering}.${rows.length ? ` ${rows.length.toLocaleString("en-US")} lines so far.` : ""} File ${index + 1} of ${recordFiles.length}.` });
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
      onGather={() => void gather().catch((cause: unknown) => setState({ step: "ready", error: readFailure(cause, "The connection dropped while gathering. Nothing was lost or changed; try again.") }))}
      onDownloadAll={async (files) => {
        // The cover carries the site's two typefaces inside it. Without them (offline, say) it still reads, in the device's own faces.
        const [serif, sans] = await Promise.all(["newsreader-latin-variable", "source-sans-3-latin-variable"].map(face));
        const cover = recordsCover({
          faces: serif && sans ? { serif, sans } : undefined,
          conference: data.church.name,
          sample: data.church.sample,
          day: format(Date.now(), { year: "numeric", month: "long", day: "numeric" }),
          by: data.user.name,
          files: files.map((file) => ({ ...file, holds: recordFiles.find((item) => item.key === file.key)?.holds ?? "" })),
        });
        const folder = { [recordsCoverName(data.church.sample)]: strToU8(cover), ...Object.fromEntries(files.map((file) => [file.fileName, strToU8(file.csv)])) };
        save(new Blob([zipSync(folder)], { type: "application/zip" }), recordsZipName(data.church.name, data.church.sample, new Date()));
      }}
      onDownload={(file) => save(new Blob([file.csv], { type: "text/csv;charset=utf-8" }), file.fileName)}
    />
  );
}
