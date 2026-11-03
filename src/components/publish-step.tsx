"use client";
import { useState } from "react";
import type { Gate } from "@/lib/approval";
import { Notice, Step } from "./ui";

type Props = { gate: Gate; blockedReason: string | null; snippet: string | null; email: string | null; preview: { code: string; dir: string; native: string; blocks: string[] }[] };

const STATE_TEXT = { pending: "waiting for approval", stale: "edited after approval", "needs-flag-check": "flags not confirmed" } as const;

export function PublishStep({ gate, blockedReason, snippet, email, preview }: Props) {
  const [tab, setTab] = useState<"preview" | "web" | "email">("preview");
  const [copied, setCopied] = useState<string | null>(null);
  const ready = gate.ready && !blockedReason && snippet && email;

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied("Copy failed. Select the text and copy it by hand.");
    }
  }

  function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Step
      n={4}
      id="publish"
      title="Publish"
      lead="Export opens only when a named reviewer has approved every block in every language, for the exact wording on screen."
      aside={
        <span className={`chip ${ready ? "chip-ok" : "chip-neutral"} text-sm tabular-nums`}>
          <span aria-hidden="true">{ready ? "✓" : "🔒"}</span> {gate.approved} of {gate.total} blocks approved
        </span>
      }
    >
      {!ready ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper p-5">
          <p className="font-semibold">
            <span aria-hidden="true">🔒 </span>Export is locked.
          </p>
          {blockedReason ? <p className="mt-1 text-sm text-mute">{blockedReason}</p> : null}
          {gate.waiting.length ? (
            <>
              <p className="mt-1 text-sm text-mute">Still waiting:</p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {gate.waiting.slice(0, 12).map((w) => (
                  <li key={`${w.code}-${w.block}`}>
                    <a className="underline decoration-line underline-offset-2 hover:decoration-accent" href={`#lang-${w.code}`}>
                      {w.name}, block {w.block + 1}
                    </a>{" "}
                    <span className="text-mute">({STATE_TEXT[w.state]})</span>
                  </li>
                ))}
                {gate.waiting.length > 12 ? <li className="text-mute">and {gate.waiting.length - 12} more</li> : null}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <div className="rise">
          <div role="tablist" aria-label="Export format" className="inline-flex rounded-full border border-line bg-paper p-1">
            {(
              [
                ["preview", "Preview"],
                ["web", "Web snippet"],
                ["email", "Email text"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                id={`tab-${k}`}
                aria-selected={tab === k}
                aria-controls={`panel-${k}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-white text-ink shadow-sm" : "text-mute"}`}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
            {tab === "preview" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {preview.map((p) => (
                  <section key={p.code} lang={p.code} dir={p.dir} className="rounded-2xl border border-line bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">{p.native}</p>
                    <h3 className="font-display mt-1 text-xl font-semibold">{p.blocks[0]}</h3>
                    {p.blocks.slice(1).map((b, i) => (
                      <p key={i} className={`mt-2 leading-relaxed ${i === p.blocks.length - 2 ? "text-sm text-mute" : ""}`}>
                        {b}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <>
                <pre className="max-h-96 overflow-auto rounded-2xl border border-line bg-[#1c2530] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[#f4efe6]">
                  {tab === "web" ? snippet : email}
                </pre>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={() => copy(tab === "web" ? "Web snippet copied." : "Email text copied.", (tab === "web" ? snippet : email)!)}>
                    Copy {tab === "web" ? "HTML" : "email text"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => (tab === "web" ? download("announcement.html", snippet!, "text/html") : download("announcement.txt", email!, "text/plain"))}
                  >
                    Download
                  </button>
                  <span aria-live="polite" className="text-sm text-ok">
                    {copied}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            <Notice>A printable flyer and scripture passages from published Bible translations are planned next.</Notice>
          </div>
        </div>
      )}
    </Step>
  );
}
