"use client";
import { useState } from "react";
import { blockState } from "@/lib/approval";
import type { GlossaryEntry } from "@/lib/glossary";
import { languageByCode } from "@/lib/languages";
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
};

const BLOCK_LABEL = (i: number, n: number) => (i === 0 ? "Title" : i === n - 1 ? "AI disclosure line" : `Paragraph ${i}`);

export function LanguageCard({ draft, source, glossary, onReviewer, onEdit, onFlags, onApprove, onUnapprove, onRecheck, onTranslate, onRemove }: Props) {
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
    <article aria-labelledby={headingId} className="rise overflow-hidden rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 id={headingId} className="font-display text-xl font-semibold">
            {lang.name}{" "}
            <span lang={lang.code} dir={lang.dir} className="font-sans text-base font-medium text-mute">
              {lang.native}
            </span>
          </h3>
          {draft.status === "ready" ? <OriginBadge draft={draft} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {draft.status === "ready" ? (
            <span className={`chip ${approved === draft.blocks.length ? "chip-ok" : "chip-neutral"} tabular-nums`}>
              {approved} of {draft.blocks.length} approved
            </span>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} aria-label={`Remove ${lang.name}`}>
            Remove
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {draft.status === "idle" || draft.status === "error" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={onTranslate}>
              Translate into {lang.name}
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
          <div role="status" className="grid gap-3">
            <p className="text-sm text-mute">Translating, then back-translating with a separate call. Free models can take 20 to 60 seconds.</p>
            <div className="shimmer h-20 rounded-xl" aria-hidden="true" />
            <div className="shimmer h-20 rounded-xl" aria-hidden="true" />
          </div>
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
                <button type="button" className="btn btn-primary btn-sm" onClick={onTranslate}>
                  Translate again
                </button>
              </div>
            ) : null}

            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={`reviewer-${draft.code}`} className="mb-1.5 block text-sm font-semibold">
                  Reviewer fluent in {lang.name}
                </label>
                <input
                  id={`reviewer-${draft.code}`}
                  className="field w-64"
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

            <div className="hidden grid-cols-3 gap-4 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-mute lg:grid">
              <span>English</span>
              <span>{lang.name}</span>
              <span>Back into English, by a separate AI call</span>
            </div>
            <ol className="grid gap-4">
              {draft.blocks.map((b, i) => {
                const v = views[i];
                const state = states[i];
                const isEditing = editing === i;
                return (
                  <li key={i} className={`rounded-xl border p-3.5 sm:p-4 ${state === "approved" ? "border-ok/40 bg-ok-soft/40" : state === "stale" || state === "needs-flag-check" ? "border-warn/40" : "border-line"}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-mute">{BLOCK_LABEL(i, draft.blocks.length)}</span>
                      <StateTag state={state} />
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
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
                          <p lang={lang.code} dir={lang.dir} className="text-lg leading-relaxed">
                            {b.text}
                          </p>
                        )}
                        {b.text !== b.ai ? <p className="mt-1 text-xs text-mute">Edited by the reviewer.</p> : null}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-mute lg:hidden">Back into English</span>
                        {v.backCurrent ? (
                          <p className="leading-relaxed text-mute italic">{b.back}</p>
                        ) : (
                          <p className="text-sm text-warn">No back-translation for this wording yet. Use &ldquo;Back-translate my edits&rdquo;, or read it closely.</p>
                        )}
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Checks">
                      {v.flags.facts.map((c, k) => (
                        <li key={`f${k}`}>
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
                      {v.flags.drift.length && v.backCurrent ? (
                        <li>
                          <StatusChip status="neutral" title="Words from the English that did not come back. Often fine. Read the underlined words.">
                            {v.flags.drift.length} word{v.flags.drift.length > 1 ? "s" : ""} did not come back
                          </StatusChip>
                        </li>
                      ) : null}
                    </ul>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {state === "approved" ? (
                        <>
                          <span className="text-sm text-ok">
                            <span aria-hidden="true">✓ </span>Approved by {b.review.reviewer}
                          </span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUnapprove(i)}>
                            Undo approval
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
                            Approve this block
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
  if (state === "approved") return <StatusChip status="ok">Approved</StatusChip>;
  if (state === "stale") return <StatusChip status="check">Edited after approval</StatusChip>;
  if (state === "needs-flag-check") return <StatusChip status="check">Flags not confirmed</StatusChip>;
  return <StatusChip status="neutral">Waiting for review</StatusChip>;
}
