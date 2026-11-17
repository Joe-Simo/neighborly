"use client";

import { LiveLoading } from "@/components/workspace/primitives";
import "./tools.css";
import { LiveFailure } from "@/components/workspace/states";
import { useEffect, useRef, type ReactNode } from "react";
import Papa from "papaparse";
import { CircleCheck, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LeftOut = { line: number; name: string; reason: string };
export type SheetStep =
  | { step: "choose"; error?: string; fileName?: string }
  | { step: "working"; label: string; progress?: string; read?: { names: string[]; lines: number }; saving?: { fileName: string; ready: number; leftOut: LeftOut[] } }
  | { step: "review"; fileName: string; ready: number; leftOut: LeftOut[]; error?: string }
  | { step: "done"; done: number; leftOut: LeftOut[]; error?: string };
export type SheetWords = {
  id: string;
  title: string;
  deck: string;
  fileHelp: string;
  /** A small file with the right columns and made-up people, to copy the shape from. */
  sample: { fileName: string; text: string };
  /** The yes itself, said the same on the sheet's heading and its button: "Invite 23 people". */
  yes: (count: number) => string;
  nothingReady: string;
  promise: string;
  done: (count: number) => string;
  nothingDone: string;
  another: string;
};

/**
 * A long file goes to the backend a batch at a time, in order. Each batch is saved whole or not at all.
 * If one fails, what came before is kept and reported, and choosing the file again finishes the rest without doubling.
 */
export async function inBatches<Row, Result>(rows: Row[], size: number, run: (batch: Row[]) => Promise<Result[]>, onProgress: (done: number) => void) {
  const results: Result[] = [];
  for (let start = 0; start < rows.length; start += size) {
    onProgress(start);
    try {
      results.push(...(await run(rows.slice(start, start + size))));
    } catch {
      return { results, finished: false };
    }
  }
  return { results, finished: true };
}
/** The first lines of a file, shown rising while the rest is checked. */
export const readSoFar = (rows: { line: number; name: string }[]) => ({ names: rows.slice(0, 6).map((row) => row.name || `Line ${row.line}`), lines: rows.length });
export const linesOf = (done: number, all: number) => `${done.toLocaleString("en-US")} of ${all.toLocaleString("en-US")} lines`;

function LeftOutRows({ rows, download }: { rows: LeftOut[]; download?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="tools-problems">
      <div className="live-section-head">
        <h3>Left out</h3>
        <span className="live-count">{rows.length === 1 ? "1 line of the file" : `${rows.length} lines of the file`}</span>
      </div>
      <div className="live-list">
        {rows.map((row) => (
          <div className="help-row" data-quiet key={row.line}>
            <div className="live-date-leaf">
              <span>Line</span>
              <strong>{row.line}</strong>
            </div>
            <div>
              <h3>{row.name || `Line ${row.line}`}</h3>
              <p>{row.reason}</p>
            </div>
          </div>
        ))}
      </div>
      {download && (
        <a className="tools-sample" download="left-out-lines.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(Papa.unparse({ fields: ["Line", "Name", "Why it was left out"], data: rows.map((row) => [row.line, row.name, row.reason]) }))}`}>
          Download the left-out lines
        </a>
      )}
    </div>
  );
}

/**
 * A spreadsheet coming in: choose the file, see what would happen, say yes, see what happened.
 * The file waiting for a yes is the one sheet on the screen; nothing is saved before that yes.
 */
export function SheetImportView({ words, state, icon, afterDone, onFile, onYes, onReset }: { words: SheetWords; state: SheetStep; icon: ReactNode; afterDone?: ReactNode; onFile: (file: File) => void; onYes: () => void; onReset: () => void }) {
  const chooser = useRef<HTMLInputElement>(null);
  // The sheet that waits for a yes stays the same sheet while the yes is being saved: still ochre, its buttons
  // at rest, its label saying what is being done. Green is for the line that comes after the save has answered.
  // If the save fails the sheet has not moved, so nothing turns back from done to waiting.
  const saving = state.step === "working" && state.saving !== undefined;
  const waiting = state.step === "review" ? state : state.step === "working" ? state.saving : undefined;
  // The sheet takes focus once when it arrives and once when its yes starts saving, never on each line of
  // progress, and only when the focus has nowhere to be: on the page itself, or on a button of the sheet that
  // has just gone to rest. Someone who has tabbed or scrolled elsewhere keeps their place.
  const sheet = useRef<HTMLElement>(null);
  const step = state.step;
  useEffect(() => {
    const paper = sheet.current;
    if (!paper) return;
    const at = document.activeElement;
    if (!at || at === document.body || (paper.contains(at) && at.matches(":disabled"))) paper.focus({ preventScroll: saving });
  }, [step, saving]);
  return (
    <section className="tools-leaf" data-open={state.step === "choose" ? undefined : ""} aria-labelledby={`${words.id}-name`}>
      <h2 id={`${words.id}-name`}>{words.title}</h2>
      <p className="tools-leaf-deck">{words.deck}</p>
      {"error" in state && state.error && <LiveFailure message={state.error} kept="" />}
      {state.step === "choose" && (
        <div className="tools-file">
          <input
            ref={chooser}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onFile(file);
            }}
          />
          <div className="help-actions">
            <Button variant="outline" onClick={() => chooser.current?.click()}><FileUp size={18} aria-hidden="true" /> Choose a CSV file</Button>
            {state.fileName && <span className="tools-file-name">{state.fileName}</span>}
          </div>
          <p className="tools-small">{words.fileHelp}</p>
          <a className="tools-sample" download={words.sample.fileName} href={`data:text/csv;charset=utf-8,${encodeURIComponent(words.sample.text)}`}>Download a sample file</a>
        </div>
      )}
      {state.step === "working" && !state.saving && (
        state.read ? (
          <ol className="tools-reading paper-rows" aria-hidden="true">
            {state.read.names.map((name, index) => <li key={index}><span>{index + 2}</span>{name}</li>)}
            {state.read.lines > state.read.names.length && <li className="tools-reading-more">and {(state.read.lines - state.read.names.length).toLocaleString("en-US")} more</li>}
          </ol>
        ) : (
          // Hidden from a screen reader here because the status line below says the same.
          <div aria-hidden="true">
            <LiveLoading label={state.label} />
          </div>
        )
      )}
      {/* While a yes is being saved the sheet's own label carries these words, so this line is for a screen reader only and nothing below the sheet moves. */}
      {state.step === "working" && <p role="status" className={state.progress && !saving ? "tools-progress" : "sr-only"}>{state.label}{state.progress && `. ${state.progress}.`}</p>}
      {waiting && (
        <>
          {/* The focus that leaves the pressed button when it goes to rest lands on the sheet and not on the page (the effect above). */}
          <section className="help-sheet tools-sheet tools-done" aria-labelledby={`${words.id}-title`} aria-busy={saving || undefined} tabIndex={-1} ref={sheet}>
            <p className="help-sheet-label">
              {state.step === "working" ? `${state.label}${state.progress ? `. ${state.progress}.` : "…"}` : waiting.ready ? "Waiting for your yes" : "Nothing to bring in"}
            </p>
            <div className="help-sheet-body">
              <div>
                <h2 id={`${words.id}-title`}>{waiting.ready ? words.yes(waiting.ready) : words.nothingReady}</h2>
                <p className="help-why">
                  From {waiting.fileName}.
                  {waiting.leftOut.length > 0 && ` ${waiting.leftOut.length === 1 ? "1 line is" : `${waiting.leftOut.length} lines are`} left out, listed below.`}
                </p>
                {waiting.ready > 0 && <p>{words.promise}</p>}
              </div>
              <div className="help-actions">
                {waiting.ready > 0 && <Button disabled={saving} onClick={onYes}>{icon} {words.yes(waiting.ready)}</Button>}
                <Button variant={waiting.ready ? "ghost" : "outline"} disabled={saving} onClick={onReset}>Choose another file</Button>
              </div>
            </div>
          </section>
          <LeftOutRows rows={waiting.leftOut} />
        </>
      )}
      {state.step === "done" && (
        <>
          <div className="live-success help-done tools-done" role="status" tabIndex={-1} ref={(node) => node?.focus()}>
            <CircleCheck size={22} aria-hidden="true" />
            <span>{state.done ? words.done(state.done) : words.nothingDone}</span>
          </div>
          <div className="help-actions tools-after">
            {state.done > 0 && afterDone}
            <Button variant="outline" onClick={onReset}>{words.another}</Button>
          </div>
          <LeftOutRows rows={state.leftOut} download />
        </>
      )}
    </section>
  );
}
