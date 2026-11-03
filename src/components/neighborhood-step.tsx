"use client";
import { useState } from "react";
import { type NeighborhoodLanguages, suggestedLanguages, zipSchema } from "@/lib/census";
import { languageByCode } from "@/lib/languages";
import { fmt, Notice, pct, Step } from "./ui";

type Props = {
  zip: string;
  data: NeighborhoodLanguages | null;
  selected: string[];
  onZip: (zip: string) => void;
  onData: (d: NeighborhoodLanguages, suggested: string[]) => void;
  onToggle: (code: string) => void;
};

export function NeighborhoodStep({ zip, data, selected, onZip, onData, onToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function look(e?: React.FormEvent) {
    e?.preventDefault();
    const z = zipSchema.safeParse(zip);
    if (!z.success) {
      setError("Enter a 5-digit ZIP code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/languages?zip=${z.data}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load Census data.");
      onData(body as NeighborhoodLanguages, suggestedLanguages(body as NeighborhoodLanguages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Census data.");
    } finally {
      setLoading(false);
    }
  }

  const groups = data ? data.groups.filter((g) => g.speakers > 0) : [];
  const shown = showAll ? groups : groups.slice(0, 6);
  const max = Math.max(1, ...groups.map((g) => g.speakers));

  return (
    <Step
      n={1}
      id="neighbors"
      title="Who are your neighbors?"
      lead="Enter your church's ZIP code. Neighborly reads the languages people speak at home there from the US Census, and how many of them speak English less than very well."
    >
      <form onSubmit={look} className="flex flex-wrap items-end gap-3" aria-describedby="zip-help">
        <div>
          <label htmlFor="zip" className="mb-1.5 block text-sm font-semibold">
            Church ZIP code
          </label>
          <input
            id="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            className="field w-36 text-lg tracking-widest tabular-nums"
            value={zip}
            onChange={(e) => onZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            aria-invalid={!!error}
          />
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Reading Census data..." : data && data.zip === zip ? "Look again" : "Show languages"}
        </button>
        <p id="zip-help" className="w-full text-sm text-mute">
          Try 33919 (Fort Myers, FL), 33908 or 66044 (Lawrence, KS).
        </p>
      </form>

      <div aria-live="polite" className="mt-4">
        {error ? (
          <Notice tone="bad" role="alert">
            {error}
          </Notice>
        ) : null}
      </div>

      {loading && !data ? <div className="shimmer mt-6 h-48 rounded-2xl" aria-hidden="true" /> : null}

      {data ? (
        <div className="rise mt-6">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Residents age 5 and over" value={fmt(data.total)} />
            <Stat label="Speak a language other than English at home" value={fmt(data.otherLanguages)} sub={pct(data.otherLanguages / Math.max(1, data.total))} />
            <Stat label='Of them, speak English less than "very well"' value={fmt(data.limitedEnglish)} sub={pct(data.limitedEnglish / Math.max(1, data.otherLanguages))} accent />
          </dl>

          <fieldset className="mt-7">
            <legend className="font-display text-lg font-semibold">Languages spoken at home in {data.zip}</legend>
            <p className="mt-1 text-sm text-mute">
              Tick the languages to publish in. We pre-selected the ones where the most people speak English less than very well.
            </p>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {shown.map((g) => (
                <li key={g.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{g.label}</span>
                      {g.lowReliability ? <span className="chip chip-neutral" title="The margin of error is at least half the estimate.">small sample, wide margin</span> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-mute tabular-nums">
                      {fmt(g.speakers)} people{g.speakersMoe !== null ? ` (±${fmt(g.speakersMoe)})` : ""} · {fmt(g.limitedEnglish)} speak English less than very well ({pct(g.limitedShare)})
                    </p>
                    {g.note ? <p className="mt-1 text-xs text-mute">{g.note}</p> : null}
                    {g.suggest.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.suggest.map((code) => {
                          const l = languageByCode(code)!;
                          const on = selected.includes(code);
                          return (
                            <label key={code} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-white hover:border-accent"}`}>
                              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={on} onChange={() => onToggle(code)} />
                              <span>{l.name}</span>
                              <span lang={code} dir={l.dir} className="text-mute">
                                {l.native}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div aria-hidden="true">
                    <div className="h-4 overflow-hidden rounded-full bg-[#f1ede5]">
                      <div className="bar relative h-full rounded-full bg-accent/35" style={{ width: `${(g.speakers / max) * 100}%` }}>
                        <div className="bar absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${g.limitedShare * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-mute">
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-full bg-accent" /> English less than very well</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-full bg-accent/35" /> All speakers</span>
              </span>
              {groups.length > 6 ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
                  {showAll ? "Show fewer" : `Show all ${groups.length} language groups`}
                </button>
              ) : null}
            </div>
          </fieldset>
          <p className="mt-4 text-xs text-mute">
            Source: US Census Bureau, American Community Survey {data.release.name} ({data.release.years}), table C16001, ZIP code tabulation area {data.zip}, read live via{" "}
            {data.source === "census.gov" ? "api.census.gov" : <a className="underline" href={`https://censusreporter.org/data/table/?table=C16001&geo_ids=86000US${data.zip}`}>Census Reporter</a>}
            . Estimates have margins of error; small groups can be off by a lot.
          </p>
        </div>
      ) : null}
    </Step>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-accent/25 bg-accent-soft" : "border-line bg-paper"}`}>
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="font-display mt-1 text-3xl font-semibold tabular-nums">
        {value}
        {sub ? <span className="ml-2 font-sans text-base font-medium text-mute">{sub}</span> : null}
      </dd>
    </div>
  );
}
