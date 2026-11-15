"use client";
import { useEffect, useRef, useState } from "react";
import { blockState } from "@/lib/approval";
import type { GlossaryEntry } from "@/lib/glossary";
import { isLatin, languageTint } from "@/lib/language-style";
import { languageByCode } from "@/lib/languages";
import { attribution, passagesFor } from "@/lib/scripture";
import { type LangDraft, sameBlocks, viewBlock } from "@/lib/workspace";
import { HighlightedSource } from "./highlight";
import { Notice, StatusChip } from "./ui";

type Props = {
  draft: LangDraft;
  source: string[];
  glossary: GlossaryEntry[];
  onReviewer: (name: string) => void;
  onEdit: (i: number, text: string) => void;
  onFlags: (i: number, checked: boolean) => void;
  onApprove: (i: number) => string | null;
  onUnapprove: (i: number) => void;
  onRecheck: () => Promise<void>;
  onTranslate: () => void;
  onRemove: () => void;
  translateDisabled?: boolean;
};

const BLOCK_LABEL = (i: number, n: number) => (i === 0 ? "Title" : i === n - 1 ? "AI disclosure line" : `Paragraph ${i}`);

export function LanguageCard({ draft, source, glossary, onReviewer, onEdit, onFlags, onApprove, onUnapprove, onRecheck, onTranslate, onRemove, translateDisabled }: Props) {
  const lang = languageByCode(draft.code)!;
  const [editing, setEditing] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [rechecking, setRechecking] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const fresh = sameBlocks(draft.from, source);
  const views = draft.blocks.map((b, i) => viewBlock(source[i] ?? "", b, draft.code, glossary));
  const states = draft.blocks.map((b, i) => (fresh ? blockState({ text: b.text, problems: views[i].problems, review: b.review }) : "pending"));
  const approved = states.filter((s) => s === "approved").length;
  const needsBack = draft.blocks.some((b, i) => !views[i].backCurrent && b.text.trim());
  const headingId = `lang-${draft.code}`;
  // Play the arrival once, when a translation lands while you watch. A saved one just sits there.
  const was = useRef(draft.status);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (was.current === "loading" && draft.status === "ready") setPlay(true);
    was.current = draft.status;
  }, [draft.status]);

  async function recheck() {
    setRechecking(true);
    setRecheckError(null);
    try {
      await onRecheck();
    } catch (e) {
      setRecheckError(e instanceof Error ? e.message : "Back-translation failed.");
    } finally {
      setRechecking(false);
    }
  }

  return (
    <article aria-labelledby={headingId} className="world rise scroll-mt-32" style={languageTint(draft.code)}>
      <header className="world-head px-5 pt-5 pb-6 sm:px-8 sm:pt-7 sm:pb-8">
        <span aria-hidden="true" lang={lang.code} className="world-mark">
          {lang.native}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="label">{lang.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {draft.status === "ready" ? (
              <span className={`chip tabular-nums ${approved === draft.blocks.length ? "chip-ok" : "bg-white/70 text-tint-ink"}`}>
                {approved} of {draft.blocks.length} signed
              </span>
            ) : null}
            <button type="button" className="btn btn-sm border border-tint-ink/30 text-tint-ink hover:bg-white/60" onClick={onRemove} aria-label={`Remove ${lang.name}`}>
              Remove
            </button>
          </div>
        </div>
        <h3 id={headingId} className="mt-6">
          <span className="sr-only">{lang.name}: </span>
          <span lang={lang.code} dir={lang.dir} className={`block text-5xl leading-[1.05] tracking-tight sm:text-7xl ${isLatin(lang.native) ? "font-display font-medium" : "font-bold"}`}>
            {lang.native}
          </span>
        </h3>
        <p lang={lang.code} dir={lang.dir} className={`mt-3 text-xl ${isLatin(lang.welcome) ? "font-display italic" : ""}`}>
          {lang.welcome}
        </p>
        {draft.status === "ready" ? (
          <div className="mt-4">
            <OriginBadge draft={draft} />
          </div>
        ) : null}
      </header>

      <div className="p-5 sm:p-8">
        {draft.status === "idle" || draft.status === "error" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={onTranslate} disabled={translateDisabled}>
              Translate into {lang.name}
              <span aria-hidden="true" className="arrow">→</span>
            </button>
            {draft.status === "error" ? (
              <div className="w-full" aria-live="polite">
                <Notice tone="warn" role="alert">
                  {draft.error}
                </Notice>
              </div>
            ) : null}
          </div>
        ) : null}

        {draft.status === "loading" ? (
          <Progress draft={draft} name={lang.name} source={source} />
        ) : null}

        {draft.status === "ready" ? (
          <>
            {draft.notice ? (
              <div className="mb-4">
                <Notice tone="warn">
                  <strong>Recorded example, not a live translation.</strong> {draft.notice} This is what the AI returned for this exact sample on{" "}
                  {new Date(draft.generatedAt ?? "").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Review it the same way.
                </Notice>
              </div>
            ) : null}
            {!fresh ? (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Notice tone="warn" role="status">
                  The English changed after this was translated, so its approvals no longer count. Translate again to continue.
                </Notice>
                <button type="button" className="btn btn-primary btn-sm" onClick={onTranslate} disabled={translateDisabled}>
                  Translate again
                </button>
              </div>
            ) : null}

            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-auto">
                <label htmlFor={`reviewer-${draft.code}`} className="label mb-2 block">
                  Reviewer fluent in {lang.name}
                </label>
                <input
                  id={`reviewer-${draft.code}`}
                  className="field w-full sm:w-64"
                  placeholder="Full name"
                  value={draft.reviewer}
                  onChange={(e) => onReviewer(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {needsBack ? (
                <button type="button" className="btn btn-ghost" onClick={recheck} disabled={rechecking}>
                  {rechecking ? "Checking edits..." : "Back-translate my edits"}
                </button>
              ) : null}
              <div aria-live="polite" className="w-full empty:hidden">
                {recheckError ? <Notice tone="warn">{recheckError}</Notice> : null}
              </div>
            </div>

            <div className="label hidden grid-cols-3 gap-6 border-b border-rule pb-3 text-mute lg:grid">
              <span>English</span>
              <span>{lang.name}</span>
              <span>Back into English, by a separate AI call</span>
            </div>
            <ol className={`grid grid-cols-1 ${play ? "play" : ""}`}>
              {draft.blocks.map((b, i) => {
                const v = views[i];
                const state = states[i];
                const isEditing = editing === i;
                return (
                  <li key={i} className={`border-b border-rule py-6 transition-colors duration-500 ${state === "approved" ? "bg-ok-soft/30" : ""} -mx-5 px-5 sm:-mx-8 sm:px-8`} style={{ "--i": i } as React.CSSProperties}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="label text-mute">{BLOCK_LABEL(i, draft.blocks.length)}</span>
                      <StateTag state={state} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
                      <div>
                        <span className="text-xs font-semibold text-mute lg:hidden">English</span>
                        <p className="leading-relaxed">
                          <HighlightedSource text={v.source} facts={v.flags.facts} drift={v.flags.drift} />
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-mute lg:hidden">{lang.name}</span>
                        {isEditing ? (
                          <textarea
                            aria-label={`${lang.name} text, ${BLOCK_LABEL(i, draft.blocks.length)}`}
                            lang={lang.code}
                            dir={lang.dir}
                            className="field min-h-28"
                            value={b.text}
                            onChange={(e) => onEdit(i, e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <p lang={lang.code} dir={lang.dir} className={`wipe leading-relaxed ${i === 0 ? "font-display text-2xl font-medium tracking-tight" : "text-lg"}`}>
                            {b.text}
                          </p>
                        )}
                        {b.text !== b.ai ? <p className="mt-1 text-xs text-mute">Edited by the reviewer.</p> : null}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-mute lg:hidden">Back into English</span>
                        {v.backCurrent ? (
                          <p className="follow leading-relaxed text-mute italic">{b.back}</p>
                        ) : (
                          <p className="text-sm text-warn">No back-translation for this wording yet. Use &ldquo;Back-translate my edits&rdquo;, or read it closely.</p>
                        )}
                      </div>
                    </div>

                    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Checks">
                      {v.flags.facts.map((c, k) => (
                        <li key={`f${k}`} className="lock" style={{ "--k": k } as React.CSSProperties}>
                          <StatusChip status={c.status} title={c.note}>
                            {c.fact.raw.replace(/[.,]$/, "")}
                            {c.status !== "ok" ? `: ${c.note}` : ""}
                          </StatusChip>
                        </li>
                      ))}
                      {v.flags.extras.map((x, k) => (
                        <li key={`x${k}`}>
                          <StatusChip status="missing">{x.note}</StatusChip>
                        </li>
                      ))}
                      {v.flags.calendar.filter((c) => c.status !== "ok").map((c, k) => (
                        <li key={`c${k}`}>
                          <StatusChip status="missing">
                            {c.status === "missing" ? `${c.word} did not come back in the back-translation` : `${c.word} appears in the back-translation but not the English`}
                          </StatusChip>
                        </li>
                      ))}
                      {v.glossary.map((g, k) => (
                        <li key={`g${k}`}>
                          <StatusChip status={g.used ? "ok" : "check"} title={`Glossary: ${g.term}`}>
                            {g.used ? `Glossary: ${g.expected}` : `Glossary says "${g.expected}" for "${g.term}"`}
                          </StatusChip>
                        </li>
                      ))}
                      {v.flags.verseText ? (
                        <li>
                          <StatusChip status="missing">{v.flags.verseText}</StatusChip>
                        </li>
                      ) : null}
                      {v.flags.drift.length && v.backCurrent ? (
                        <li>
                          <StatusChip status="neutral" title="Words from the English that did not come back. Often fine. Read the underlined words.">
                            {v.flags.drift.length} word{v.flags.drift.length > 1 ? "s" : ""} did not come back
                          </StatusChip>
                        </li>
                      ) : null}
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {state === "approved" ? (
                        <>
                          <span className="mr-2 inline-flex flex-wrap items-baseline gap-x-3">
                            <span className="label text-ok">Signed by</span>
                            <span className="signature">
                              {b.review.reviewer}
                              <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                                <path pathLength={1} d="M1 7C18 2 30 9 47 5S78 1 99 6" />
                              </svg>
                            </span>
                          </span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUnapprove(i)}>
                            Undo
                          </button>
                        </>
                      ) : (
                        <>
                          {v.problems > 0 ? (
                            <label className="inline-flex min-h-9 items-center gap-2 text-sm">
                              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={b.flagsChecked} onChange={(e) => onFlags(i, e.target.checked)} />
                              I checked the {v.problems > 1 ? `${v.problems} flagged items` : "flagged item"}
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ok btn-sm"
                            disabled={!fresh}
                            onClick={() => {
                              const err = onApprove(i);
                              setErrors((e) => ({ ...e, [i]: err ?? "" }));
                              if (!err) setEditing(null);
                            }}
                          >
                            Sign this block
                          </button>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(isEditing ? null : i)} aria-pressed={isEditing}>
                        {isEditing ? "Done editing" : "Edit"}
                      </button>
                      <span aria-live="polite" className="text-sm font-medium text-bad">
                        {errors[i]}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <ScripturePanel source={source} code={draft.code} name={lang.name} dir={lang.dir} />
          </>
        ) : null}
      </div>
    </article>
  );
}

function OriginBadge({ draft }: { draft: LangDraft }) {
  if (draft.origin === "recorded") return <span className="chip chip-check">Recorded example · {draft.model}</span>;
  if (draft.origin === "cache") return <span className="chip chip-neutral">Live AI, from cache · {draft.model}</span>;
  return <span className="chip border-accent/20 bg-accent-soft text-accent-ink">Live AI · {draft.model}</span>;
}

function StateTag({ state }: { state: string }) {
  if (state === "approved") return <StatusChip status="ok">Signed</StatusChip>;
  if (state === "stale") return <StatusChip status="check">Edited after approval</StatusChip>;
  if (state === "needs-flag-check") return <StatusChip status="check">Flags not confirmed</StatusChip>;
  return <StatusChip status="neutral">Waiting for review</StatusChip>;
}

const PHASES = [
  { id: "queued", label: "Waiting in line" },
  { id: "translating", label: "Translating" },
  { id: "back-translating", label: "Back-translating with a separate call" },
] as const;

/** Free models often take 20 to 60 seconds. Show the real step from the server, the time so far, and an honest estimate. */
function Progress({ draft, name, source }: { draft: LangDraft; name: string; source: string[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const phase = draft.phase ?? "translating";
  const step = PHASES.findIndex((p) => p.id === phase);
  const secs = draft.startedAt ? Math.max(0, Math.round((now - draft.startedAt) / 1000)) : 0;
  // Estimate only: about 25 s per call on the free tier. Never reaches 100 until the answer is back.
  const est = phase === "queued" ? 0 : Math.min(95, (phase === "back-translating" ? 50 : 0) + Math.min(45, (secs / 25) * 45));
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-medium tracking-tight">
          {phase === "queued" ? `${name} is waiting for the language ahead of it to finish.` : `${PHASES[step].label} into ${name}...`}
        </p>
        {phase !== "queued" ? <span className="text-sm text-mute tabular-nums">{secs} s so far</span> : null}
      </div>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {PHASES.slice(1).map((p, i) => {
          const done = step > i + 1;
          const current = step === i + 1;
          return (
            <li key={p.id} aria-current={current ? "step" : undefined} className={`chip ${done ? "chip-ok" : current ? "border-accent/30 bg-accent-soft text-accent-ink" : "chip-neutral"}`}>
              <span aria-hidden="true">{done ? "✓" : i + 1}</span> {p.label}
            </li>
          );
        })}
        <li className="chip chip-neutral">
          <span aria-hidden="true">3</span> Code checks run in your browser
        </li>
      </ol>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="bar h-full rounded-full bg-tint-ink" style={{ width: `${est}%` }} />
      </div>
      <p className="text-xs text-mute">The bar is an estimate. Free AI models usually take 20 to 60 seconds for both calls. You can keep working on other languages.</p>
      {/* The English waits here; the light passing over it is the work being done. */}
      <div aria-hidden="true" className="mt-2 grid gap-3 border-t border-rule pt-4">
        {source.slice(0, 4).map((t, i) => (
          <p key={i} className={`sweep rounded px-1 text-mute ${i === 0 ? "font-display text-xl" : "line-clamp-2"}`} style={{ animationDelay: `${i * 180}ms` }}>
            {t}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Verses come from bundled public-domain Bibles, never from the AI. */
function ScripturePanel({ source, code, name, dir }: { source: string[]; code: string; name: string; dir: "ltr" | "rtl" }) {
  const passages = passagesFor(source, code, name);
  if (!passages.length) return null;
  return (
    <section aria-label="Scripture" className="mt-5 rounded-xl border border-gold/40 bg-gold-soft/50 p-4">
      <h4 className="text-sm font-semibold">Scripture, inserted from a public-domain Bible (not AI)</h4>
      <ul className="mt-2 grid grid-cols-1 gap-3">
        {passages.map((p, i) =>
          p.kind === "text" ? (
            <li key={i}>
              <blockquote lang={code} dir={dir} className="font-display text-lg leading-relaxed">
                &ldquo;{p.text}&rdquo;
              </blockquote>
              <p className="mt-1 text-sm text-mute">
                {attribution(p)}.{" "}
                <a href={p.url} className="underline underline-offset-2 hover:text-accent-ink" target="_blank" rel="noreferrer">
                  Source<span className="sr-only"> for {p.label} (opens in a new tab)</span>
                </a>
              </p>
            </li>
          ) : (
            <li key={i} className="text-sm">
              <span className="font-semibold">{p.english}</span>: {p.note}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
