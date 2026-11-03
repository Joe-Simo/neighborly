"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { approve, exportGate, unapprove } from "@/lib/approval";
import type { GlossaryEntry } from "@/lib/glossary";
import { textHash } from "@/lib/hash";
import { languageByCode, TARGET_LANGUAGES } from "@/lib/languages";
import { emailText, webSnippet } from "@/lib/publish";
import { SAMPLES, toBlocks } from "@/lib/samples";
import { type BlockDraft, initialWorkspace, type LangDraft, loadWorkspace, sameBlocks, saveWorkspace, toReview, viewBlock, type Workspace as WS } from "@/lib/workspace";
import { ComposeStep } from "./compose-step";
import { LanguageCard } from "./language-card";
import { NeighborhoodStep } from "./neighborhood-step";
import { PublishStep } from "./publish-step";
import { Notice, Step } from "./ui";

type Status = { live: boolean; enabled: boolean; resting: boolean; callsToday: number; cap: number };

const cleanGlossary = (g: GlossaryEntry[]) =>
  g
    .filter((x) => x.term.trim())
    .map((x) => ({ term: x.term.trim(), note: x.note, preferred: Object.fromEntries(Object.entries(x.preferred).filter(([, v]) => v && v.trim())) }));

export function Workspace() {
  const [w, setW] = useState<WS>(loadWorkspace);
  const [status, setStatus] = useState<Status | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => saveWorkspace(w), [w]);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => alive && setStatus(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const source = useMemo(() => toBlocks(w.title, w.body), [w.title, w.body]);
  const setLang = (code: string, f: (l: LangDraft) => LangDraft) => setW((s) => (s.langs[code] ? { ...s, langs: { ...s.langs, [code]: f(s.langs[code]) } } : s));
  const setBlock = (code: string, i: number, f: (b: BlockDraft) => BlockDraft) => setLang(code, (l) => ({ ...l, blocks: l.blocks.map((b, j) => (j === i ? f(b) : b)) }));

  const ensureLang = (s: WS, code: string): WS =>
    s.langs[code] ? s : { ...s, langs: { ...s.langs, [code]: { code, status: "idle", reviewer: "", from: [], blocks: [] } } };

  function toggle(code: string) {
    setW((s) => {
      const on = s.selected.includes(code);
      const selected = on ? s.selected.filter((c) => c !== code) : [...s.selected, code];
      return on ? { ...s, selected } : ensureLang({ ...s, selected }, code);
    });
  }

  function translateOne(code: string) {
    const blocks = source;
    const glossary = cleanGlossary(w.glossary);
    setW((s) => {
      const t = ensureLang(s, code);
      return { ...t, langs: { ...t.langs, [code]: { ...t.langs[code], status: "loading", error: undefined } } };
    });
    // One language at a time keeps the free tier from rate limiting us.
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: code, blocks, glossary }) });
        const body = await res.json().catch(() => ({ error: "The server did not answer." }));
        if (!res.ok) throw new Error(body.error ?? "Translation failed.");
        setLang(code, (l) => ({
          ...l,
          status: "ready",
          origin: body.origin,
          model: body.model,
          generatedAt: body.generatedAt,
          notice: body.notice,
          from: blocks,
          blocks: (body.blocks as { text: string; back: string }[]).map((b) => ({ ai: b.text, text: b.text, back: b.back, backFor: textHash(b.text), review: unapprove(), flagsChecked: false })),
        }));
      } catch (e) {
        setLang(code, (l) => ({ ...l, status: l.blocks.length && sameBlocks(l.from, blocks) ? "ready" : "error", error: e instanceof Error ? e.message : "Translation failed." }));
      } finally {
        fetch("/api/status")
          .then((r) => r.json())
          .then(setStatus)
          .catch(() => {});
      }
    });
  }

  async function recheck(code: string) {
    const l = w.langs[code];
    const res = await fetch("/api/backtranslate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: code, blocks: l.blocks.map((b) => b.text || " ") }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Back-translation failed.");
    setLang(code, (cur) => ({
      ...cur,
      blocks: cur.blocks.map((b, i) => (b.text === l.blocks[i].text ? { ...b, back: body.blocks[i], backFor: textHash(b.text) } : b)),
    }));
  }

  function approveBlock(code: string, i: number): string | null {
    const l = w.langs[code];
    const b = l.blocks[i];
    const v = viewBlock(source[i] ?? "", b, code, w.glossary);
    const r = approve({ text: b.text, problems: v.problems, review: b.review }, l.reviewer, b.flagsChecked);
    if (!r.ok) return r.reason;
    setBlock(code, i, (x) => ({ ...x, review: r.review }));
    return null;
  }

  const active = w.selected.map((c) => w.langs[c]).filter(Boolean);
  const reviews = active.filter((l) => l.status === "ready").map((l) => toReview(l, source, w.glossary, languageByCode(l.code)!.name));
  const gate = exportGate(active.map((l) => (l.status === "ready" ? toReview(l, source, w.glossary, languageByCode(l.code)!.name) : { code: l.code, name: languageByCode(l.code)!.name, reviewer: l.reviewer, blocks: [{ text: "", problems: 0, review: unapprove() }] })));
  const blockedReason = !active.length ? "Pick at least one language in step 1." : active.some((l) => l.status !== "ready") ? "Translate every selected language first." : null;
  let snippet: string | null = null;
  let email: string | null = null;
  if (gate.ready && !blockedReason) {
    snippet = webSnippet(source, reviews);
    email = emailText(source, reviews);
  }
  const preview = gate.ready
    ? [{ code: "en", dir: "ltr", native: "English", blocks: source }, ...reviews.map((r) => ({ code: r.code, dir: languageByCode(r.code)!.dir, native: languageByCode(r.code)!.native, blocks: r.blocks.map((b) => b.text) }))]
    : [];
  const otherLangs = TARGET_LANGUAGES.filter((l) => !w.selected.includes(l.code));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusPill status={status} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (window.confirm("Start over? This clears the languages, translations and approvals saved in this browser.")) setW(initialWorkspace());
          }}
        >
          Start over
        </button>
      </div>

      <NeighborhoodStep
        zip={w.zip}
        data={w.neighborhood}
        selected={w.selected}
        onZip={(zip) => setW((s) => ({ ...s, zip }))}
        onData={(d, suggested) =>
          setW((s) => {
            let next: WS = { ...s, neighborhood: d, selected: suggested };
            for (const c of suggested) next = ensureLang(next, c);
            return next;
          })
        }
        onToggle={toggle}
      />

      <ComposeStep
        sampleId={w.sampleId}
        title={w.title}
        body={w.body}
        glossary={w.glossary}
        selected={w.selected}
        onSample={(id) => {
          const s = SAMPLES.find((x) => x.id === id)!;
          setW((cur) => ({ ...cur, sampleId: id, title: s.title, body: s.body }));
        }}
        onText={(title, body) => setW((s) => ({ ...s, title, body, sampleId: SAMPLES.find((x) => x.title === title && x.body === body)?.id ?? null }))}
        onGlossary={(glossary) => setW((s) => ({ ...s, glossary }))}
      />

      <Step
        n={3}
        id="review"
        title="Translate and review"
        lead="The AI translates each block using your glossary. A second, separate call turns it back into English without seeing the original, and code checks every time, date, number, phone and address. A fluent volunteer approves each block."
      >
        {active.length === 0 ? (
          <Notice>Pick languages in step 1, or add one here.</Notice>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => active.filter((l) => l.status !== "loading" && !(l.status === "ready" && sameBlocks(l.from, source))).forEach((l) => translateOne(l.code))}
              disabled={active.every((l) => l.status === "loading" || (l.status === "ready" && sameBlocks(l.from, source)))}
            >
              Translate {active.length === 1 ? languageByCode(active[0].code)!.name : `all ${active.length} languages`}
            </button>
            <span className="text-sm text-mute">Languages run one after another. Each uses two AI calls.</span>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="add-lang" className="text-sm font-semibold">
            Add a language
          </label>
          <select
            id="add-lang"
            className="field w-auto py-2 text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value) toggle(e.target.value);
            }}
          >
            <option value="">Choose...</option>
            {otherLangs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.native})
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 grid gap-6">
          {active.map((l) => (
            <LanguageCard
              key={l.code}
              draft={l}
              source={source}
              glossary={w.glossary}
              onReviewer={(name) => setLang(l.code, (x) => ({ ...x, reviewer: name }))}
              onEdit={(i, text) => setBlock(l.code, i, (b) => ({ ...b, text, review: b.review.status === "approved" ? unapprove() : b.review, flagsChecked: false }))}
              onFlags={(i, checked) => setBlock(l.code, i, (b) => ({ ...b, flagsChecked: checked }))}
              onApprove={(i) => approveBlock(l.code, i)}
              onUnapprove={(i) => setBlock(l.code, i, (b) => ({ ...b, review: unapprove() }))}
              onRecheck={() => recheck(l.code)}
              onTranslate={() => translateOne(l.code)}
              onRemove={() => toggle(l.code)}
            />
          ))}
        </div>
      </Step>

      <PublishStep gate={gate} blockedReason={blockedReason} snippet={snippet} email={email} preview={preview} />
    </div>
  );
}

function StatusPill({ status }: { status: Status | null }) {
  if (!status) return <span className="chip chip-neutral">Checking the AI service...</span>;
  if (status.live)
    return (
      <span className="chip chip-ok" role="status">
        <span aria-hidden="true">●</span> Live AI on, free tier ({status.callsToday} of {status.cap} calls used today)
      </span>
    );
  return (
    <span className="chip chip-check" role="status">
      <span aria-hidden="true">●</span> {status.enabled ? "Free AI tier resting until tomorrow" : "Live AI off"}. Samples show recorded examples.
    </span>
  );
}
