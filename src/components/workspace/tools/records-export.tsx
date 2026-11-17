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
import { counted } from "@/components/workspace/tools/sheet-import";
import { formatDate } from "@/lib/words";
import { fill } from "@/lib/words/fill";
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
function FileRows({ files, onDownload }: { files: GatheredFile[]; onDownload?: (file: GatheredFile) => void }) {
  const { words } = useWorkspace();
  const text = words.rooms.tools.records;
  const count = (amount: number) => counted(Math.round(amount), words.locale);
  return files.map((file) => (
    <div className="help-row" data-quiet={file.lines ? undefined : ""} key={file.key}>
      <div className="live-date-leaf">
        <span>{text.lines(file.lines)}</span>
        <strong><span className="count-up">{count(file.lines)}</span></strong>
      </div>
      <div>
        <h3>{file.title}</h3>
        <p>{file.lines ? file.fileName : text.nothingYet}</p>
      </div>
      {onDownload && file.lines > 0 && (
        <Button variant="link" className="tools-one" aria-label={text.downloadOneLabel(file.title)} onClick={() => onDownload(file)}>
          {text.downloadOne}
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
  const text = useWorkspace().words.rooms.tools.records;
  return (
    <section className={`tools-leaf tools-leaf-wide paper-corner${state.step === "done" ? " paper-fold" : ""}`} data-open={state.step === "ready" ? undefined : ""} aria-labelledby="records-export-name">
      <h2 id="records-export-name">{text.title}</h2>
      <p className="tools-leaf-deck">
        {text.deck}
      </p>
      {"error" in state && state.error && <LiveFailure message={state.error} kept="" />}
      {state.step === "ready" && (
        <div className="tools-file">
          <div className="help-actions">
            <Button onClick={onGather}><FolderDown size={18} aria-hidden="true" /> {text.gather}</Button>
          </div>
          <p className="tools-small">
            {text.what}
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
            <span>{text.ready}</span>
          </div>
          {filled.length > 0 && (
            <div className="help-actions tools-after tools-bundle-line">
              <span className="tools-bundle" key={lifted} data-lifted={lifted ? "" : undefined} aria-hidden="true"><i /><i /><i /></span>
              <Button onClick={() => { setLifted((times) => times + 1); onDownloadAll(state.files); }}>
                <Download size={18} aria-hidden="true" /> {text.downloadAll(state.files.length)}
              </Button>
            </div>
          )}
          <div className="live-list tools-records">
            <FileRows files={state.files} onDownload={onDownload} />
          </div>
          <div className="help-actions tools-after">
            <Button variant="outline" onClick={onReset}>{text.hide}</Button>
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
  const { data, isOwner, words } = useWorkspace();
  const text = words.rooms.tools.records;
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
        setState({ step: "working", files: [...files], progress: fill(rows.length ? text.progressSoFar : text.progress, { gathering: text.gathering[file.key], lines: counted(rows.length, words.locale), index: index + 1, all: recordFiles.length }) });
        const page: { columns: string[]; rows: string[][]; cursor: string; done: boolean } = await convex.query(api.importExport.exportPage, { churchId, file: file.key, cursor });
        rows.push(...page.rows);
        ({ columns, cursor, done } = page);
      }
      files.push({ key: file.key, title: text.files[file.key], fileName: recordsFileName(file.key, data.church.sample), lines: rows.length, csv: recordsCsv(columns, rows) });
    }
    setState({ step: "done", files });
  };
  return (
    <RecordsExportView
      state={state}
      onReset={() => setState({ step: "ready" })}
      onGather={() => void gather().catch((cause: unknown) => setState({ step: "ready", error: readFailure(cause, text.failed, words.states.offlineSave) }))}
      onDownloadAll={async (files) => {
        // The cover carries the site's two typefaces inside it. Without them (offline, say) it still reads, in the device's own faces.
        const [serif, sans] = await Promise.all(["newsreader-latin-variable", "source-sans-3-latin-variable"].map(face));
        const cover = recordsCover({
          faces: serif && sans ? { serif, sans } : undefined,
          conference: data.church.name,
          sample: data.church.sample,
          // The cover is English whole (see below), so its day is written the English way.
          day: formatDate("en", Date.now(), { timeZone: data.church.timeZone, year: "numeric", month: "long", day: "numeric" }),
          by: data.user.name,
          // The cover sheet is written by records.ts and is English whole, so it names each file in English too.
          files: files.map((file) => { const record = recordFiles.find((item) => item.key === file.key); return { ...file, title: record?.title ?? file.title, holds: record?.holds ?? "" }; }),
        });
        const folder = { [recordsCoverName(data.church.sample)]: strToU8(cover), ...Object.fromEntries(files.map((file) => [file.fileName, strToU8(file.csv)])) };
        save(new Blob([zipSync(folder)], { type: "application/zip" }), recordsZipName(data.church.name, data.church.sample, new Date()));
      }}
      onDownload={(file) => save(new Blob([file.csv], { type: "text/csv;charset=utf-8" }), file.fileName)}
    />
  );
}
