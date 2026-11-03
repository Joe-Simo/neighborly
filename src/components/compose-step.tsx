"use client";
import { useMemo, useState } from "react";
import { extractFacts } from "@/lib/checks";
import type { GlossaryEntry } from "@/lib/glossary";
import { languageByCode } from "@/lib/languages";
import { SAMPLES, toBlocks } from "@/lib/samples";
import { Step } from "./ui";

type Props = {
  sampleId: string | null;
  title: string;
  body: string;
  glossary: GlossaryEntry[];
  selected: string[];
  onSample: (id: string) => void;
  onText: (title: string, body: string) => void;
  onGlossary: (g: GlossaryEntry[]) => void;
};

const KIND_LABEL: Record<string, string> = { time: "Time", date: "Date", money: "Money", phone: "Phone", email: "Email", url: "Link", address: "Address", number: "Number" };

export function ComposeStep({ sampleId, title, body, glossary, selected, onSample, onText, onGlossary }: Props) {
  const blocks = useMemo(() => toBlocks(title, body), [title, body]);
  const facts = useMemo(() => blocks.flatMap((b) => extractFacts(b)), [blocks]);
  const chars = blocks.join("").length;
  const [open, setOpen] = useState(false);

  return (
    <Step
      n={2}
      id="announcement"
      title="Write the announcement"
      lead="Start from a sample for the fictional Grace Fellowship, or paste your own. Each paragraph becomes a block that gets translated, checked and approved on its own."
    >
      <fieldset>
        <legend className="text-sm font-semibold">Sample announcements</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sampleId === s.id}
              onClick={() => onSample(s.id)}
              className={`btn btn-sm ${sampleId === s.id ? "btn-primary" : "btn-ghost"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4">
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-semibold">
            Title
          </label>
          <input id="title" className="field font-display text-lg" value={title} maxLength={140} onChange={(e) => onText(e.target.value, body)} />
        </div>
        <div>
          <label htmlFor="body" className="mb-1.5 block text-sm font-semibold">
            Announcement
          </label>
          <textarea id="body" className="field min-h-56" value={body} onChange={(e) => onText(title, e.target.value)} aria-describedby="body-help" />
          <p id="body-help" className={`mt-1 text-xs ${chars > 4000 ? "font-semibold text-bad" : "text-mute"}`}>
            {blocks.length} blocks, {chars.toLocaleString("en-US")} of 4,000 characters. Leave a blank line between paragraphs. The line &ldquo;{blocks[blocks.length - 1]}&rdquo; is added at the end and translated too.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
        <h3 className="text-sm font-semibold">Facts the code will check in every translation</h3>
        {facts.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Facts found">
            {facts.map((f, i) => (
              <li key={i} className="chip border-gold/30 bg-gold-soft text-ink">
                <span className="text-xs font-semibold uppercase tracking-wide text-warn">{KIND_LABEL[f.kind]}</span>
                {f.raw.replace(/[.,]$/, "")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-mute">No times, dates, numbers or addresses found.</p>
        )}
      </div>

      <details className="mt-5 rounded-2xl border border-line" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer rounded-2xl px-4 py-3 font-semibold">
          Church glossary <span className="font-normal text-mute">({glossary.length} terms, sent with every translation)</span>
        </summary>
        <div className="border-t border-line p-4">
          <p className="text-sm text-mute">
            Words your church uses in a set way. The AI is told to use them, and the review shows whether it did. Names in the glossary with no translations are kept exactly as written.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Glossary terms and preferred translations</caption>
              <thead>
                <tr className="text-mute">
                  <th scope="col" className="py-2 pr-3 font-medium">English term</th>
                  {(selected.length ? selected : ["es"]).map((c) => (
                    <th key={c} scope="col" className="py-2 pr-3 font-medium">
                      {languageByCode(c)?.name}
                    </th>
                  ))}
                  <th scope="col" className="py-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {glossary.map((g, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5 pr-3">
                      <input aria-label={`Term ${i + 1}`} className="field py-1.5 text-sm" value={g.term} onChange={(e) => onGlossary(glossary.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))} />
                    </td>
                    {(selected.length ? selected : ["es"]).map((c) => (
                      <td key={c} className="py-1.5 pr-3">
                        <input
                          aria-label={`${g.term} in ${languageByCode(c)?.name}`}
                          lang={c}
                          dir={languageByCode(c)?.dir}
                          className="field py-1.5 text-sm"
                          value={g.preferred[c] ?? ""}
                          placeholder={Object.keys(g.preferred).length === 0 ? "keep as is" : ""}
                          onChange={(e) => onGlossary(glossary.map((x, j) => (j === i ? { ...x, preferred: { ...x.preferred, [c]: e.target.value } } : x)))}
                        />
                      </td>
                    ))}
                    <td className="py-1.5">
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${g.term}`} onClick={() => onGlossary(glossary.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => onGlossary([...glossary, { term: "", preferred: {} }])}>
            Add a term
          </button>
        </div>
      </details>
    </Step>
  );
}
