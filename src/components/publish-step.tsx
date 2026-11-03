"use client";
import { useState } from "react";
import type { Gate } from "@/lib/approval";
import type { PublishedLanguage } from "@/lib/publish";
import { attribution } from "@/lib/scripture";
import { Step } from "./ui";

type Props = { gate: Gate; blockedReason: string | null; snippet: string | null; email: string | null; preview: PublishedLanguage[] };
type Tab = "preview" | "flyer" | "web" | "email";

const STATE_TEXT = { pending: "waiting for approval", stale: "edited after approval", "needs-flag-check": "flags not confirmed" } as const;

export function PublishStep({ gate, blockedReason, snippet, email, preview }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
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
          <div role="tablist" aria-label="Export format" className="-mx-1 flex max-w-full overflow-x-auto px-1 pb-1">
            <div className="inline-flex shrink-0 rounded-full border border-line bg-paper p-1">
            {(
              [
                ["preview", "Preview"],
                ["flyer", "Printable flyers"],
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
                className={`min-h-10 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${tab === k ? "bg-white text-ink shadow-sm" : "text-mute hover:text-ink"}`}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
            </div>
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
            {tab === "preview" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {preview.map((p) => (
                  <section key={p.code} lang={p.code} dir={p.dir} className="rounded-2xl border border-line bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">{p.native}</p>
                    <h3 className="font-display mt-1 text-xl font-semibold">{p.title}</h3>
                    {p.paragraphs.map((b, i) => (
                      <p key={i} className="mt-2 leading-relaxed">
                        {b}
                      </p>
                    ))}
                    {p.verses.map((v, i) => (
                      <blockquote key={i} className="mt-3 border-s-4 border-gold ps-3">
                        <p className="font-display leading-relaxed">&ldquo;{v.text}&rdquo;</p>
                        <p className="mt-1 text-xs text-mute" dir="auto">{attribution(v)}</p>
                      </blockquote>
                    ))}
                    {p.disclosure ? <p className="mt-3 text-sm text-mute">{p.disclosure}</p> : null}
                  </section>
                ))}
              </div>
            ) : tab === "flyer" ? (
              <div>
                <p className="max-w-2xl text-sm text-mute">
                  One letter-size page per language, with the approved text, any verse from a public-domain Bible, and the translated AI disclosure line. Each opens in a new tab ready to print or save as PDF.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {preview.map((p) => (
                    <li key={p.code}>
                      <a
                        href={`/flyer?lang=${encodeURIComponent(p.code)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 font-semibold hover:border-accent"
                      >
                        <span>
                          {p.name}{" "}
                          <span lang={p.code} className="font-normal text-mute">
                            {p.code === "en" ? "" : p.native}
                          </span>
                        </span>
                        <span className="text-sm text-accent-ink">
                          Open flyer<span className="sr-only"> for {p.name} (opens in a new tab)</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
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
        </div>
      )}
    </Step>
  );
}
