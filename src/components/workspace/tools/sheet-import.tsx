"use client";

import { useRef, type ReactNode } from "react";
import { CircleCheck, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LeftOut = { line: number; name: string; reason: string };
export type SheetStep =
  | { step: "choose"; error?: string; fileName?: string }
  | { step: "working"; label: string }
  | { step: "review"; fileName: string; ready: number; leftOut: LeftOut[]; error?: string }
  | { step: "done"; done: number; leftOut: LeftOut[] };
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

function LeftOutRows({ rows }: { rows: LeftOut[] }) {
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
    </div>
  );
}

/**
 * A spreadsheet coming in: choose the file, see what would happen, say yes, see what happened.
 * The file waiting for a yes is the one sheet on the screen; nothing is saved before that yes.
 */
export function SheetImportView({ words, state, icon, afterDone, onFile, onYes, onReset }: { words: SheetWords; state: SheetStep; icon: ReactNode; afterDone?: ReactNode; onFile: (file: File) => void; onYes: () => void; onReset: () => void }) {
  const chooser = useRef<HTMLInputElement>(null);
  return (
    <section className="live-section">
      <div className="live-section-head">
        <h2>{words.title}</h2>
      </div>
      <p className="live-deck">{words.deck}</p>
      {"error" in state && state.error && <div className="live-error" role="alert"><p>{state.error}</p></div>}
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
      {state.step === "working" && (
        <div className="help-skeleton" role="status" aria-label={state.label}>
          <div><i /><span><b /><b /></span></div>
          <div><i /><span><b /><b /></span></div>
        </div>
      )}
      {state.step === "review" && (
        <>
          <section className="help-sheet tools-sheet" aria-labelledby={`${words.id}-title`}>
            <p className="help-sheet-label">{state.ready ? "Waiting for your yes" : "Nothing to bring in"}</p>
            <div className="help-sheet-body">
              <div>
                <h2 id={`${words.id}-title`}>{state.ready ? words.yes(state.ready) : words.nothingReady}</h2>
                <p className="help-why">
                  From {state.fileName}.
                  {state.leftOut.length > 0 && ` ${state.leftOut.length === 1 ? "1 line is" : `${state.leftOut.length} lines are`} left out, listed below.`}
                </p>
                {state.ready > 0 && <p>{words.promise}</p>}
              </div>
              <div className="help-actions">
                {state.ready > 0 && <Button onClick={onYes}>{icon} {words.yes(state.ready)}</Button>}
                <Button variant={state.ready ? "ghost" : "outline"} onClick={onReset}>Choose another file</Button>
              </div>
            </div>
          </section>
          <LeftOutRows rows={state.leftOut} />
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
          <LeftOutRows rows={state.leftOut} />
        </>
      )}
    </section>
  );
}
