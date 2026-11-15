"use client";
import { useEffect, useRef, useState } from "react";
import { type NeighborhoodLanguages, suggestedLanguages, zipSchema } from "@/lib/census";
import { dotsFor, figureDots } from "@/lib/figure";
import { languageByCode } from "@/lib/languages";
import { fmt, Notice, pct } from "./ui";

const TRY = ["33919", "33908", "66044"];

type ZipProps = {
  zip: string;
  data: NeighborhoodLanguages | null;
  onZip: (zip: string) => void;
  onData: (d: NeighborhoodLanguages, suggested: string[]) => void;
};

/** The one question the whole flow starts from. It lives in the hero. */
export function ZipForm({ zip, data, onZip, onData }: ZipProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function look(value: string) {
    const z = zipSchema.safeParse(value);
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        look(zip);
      }}
      aria-describedby="zip-help"
    >
      <label htmlFor="zip" className="label mb-2 block text-ink">
        Your church&rsquo;s ZIP code
      </label>
      <div className="flex flex-wrap items-stretch gap-3">
        <input
          id="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          className="field font-display w-40 rounded-2xl px-5 py-2 text-3xl tracking-[0.12em] tabular-nums"
          value={zip}
          onChange={(e) => onZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          aria-invalid={!!error}
        />
        <button className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? "Reading the Census..." : data && data.zip === zip ? "Look again" : "Meet your neighbors"}
          <span aria-hidden="true" className="arrow">→</span>
        </button>
      </div>
      <p id="zip-help" className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-mute">
        Or try
        {TRY.map((z) => (
          <button
            key={z}
            type="button"
            className="rounded-full px-2 py-1 font-medium text-accent-ink tabular-nums underline decoration-rule underline-offset-4 hover:decoration-accent"
            onClick={() => {
              onZip(z);
              look(z);
            }}
          >
            {z}
          </button>
        ))}
      </p>
      <div aria-live="polite" className="mt-3 empty:hidden">
        {error ? (
          <Notice tone="bad" role="alert">
            {error}
          </Notice>
        ) : null}
      </div>
    </form>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Count up to a number once it is switched on. */
function useCount(target: number, on: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const ms = reducedMotion() ? 1 : 1100;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on]);
  return on ? n : 0;
}

/**
 * The neighborhood as one picture, told in three beats: everyone, those who speak another language at home,
 * and those among them the invitation is for.
 */
function Figure({ data }: { data: NeighborhoodLanguages }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const d = figureDots(data.total, data.otherLanguages, data.limitedEnglish);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (reducedMotion()) return setPhase(3);
        setPhase(1);
        timers.push(setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 3000));
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [data.zip]);

  const total = useCount(data.total, phase >= 1);
  const other = useCount(data.otherLanguages, phase >= 2);
  const limited = useCount(data.limitedEnglish, phase >= 3);

  return (
    <div ref={ref} className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <dl className="grid content-start gap-6 lg:col-span-5">
        <Beat on={phase >= 1} value={total} swatch="bg-ink/20">
          neighbors age 5 and over live in {data.zip}
        </Beat>
        <Beat on={phase >= 2} value={other} swatch="bg-accent" share={pct(data.otherLanguages / Math.max(1, data.total))}>
          speak a language other than English at home
        </Beat>
        <Beat on={phase >= 3} value={limited} swatch="bg-gold-bright" share={pct(data.limitedEnglish / Math.max(1, data.otherLanguages))} strong>
          of them speak English less than &ldquo;very well&rdquo;. This invitation is for them.
        </Beat>
      </dl>
      <div className="lg:col-span-7">
        <div aria-hidden="true" data-phase={phase} className="dotfield">
          {Array.from({ length: d.all }, (_, i) => (
            <span
              key={i}
              className="dot"
              data-layer={i < d.limited && phase >= 3 ? "limited" : i < d.other && phase >= 2 ? "other" : undefined}
              style={{ "--d": phase === 1 ? Math.min(900, i * 1.4) : Math.min(700, i * 7) } as React.CSSProperties}
            />
          ))}
        </div>
        <p className="label mt-4 text-mute">One dot is about {fmt(d.unit)} {d.unit === 1 ? "neighbor" : "neighbors"}</p>
      </div>
    </div>
  );
}

function Beat({ on, value, share, swatch, strong, children }: { on: boolean; value: number; share?: string; swatch: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div data-on={on} className="caption flex gap-4">
      <span aria-hidden="true" className={`mt-4 size-3 shrink-0 rounded-full ${swatch}`} />
      <div>
        <dd className={`font-display text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-6xl ${strong ? "text-gold" : ""}`}>
          {fmt(value)}
          {share ? <span className="ml-3 font-sans text-base font-medium tracking-normal text-mute">{share}</span> : null}
        </dd>
        <dt className={`mt-2 max-w-sm ${strong ? "font-medium text-ink" : "text-mute"}`}>{children}</dt>
      </div>
    </div>
  );
}

type Props = {
  data: NeighborhoodLanguages | null;
  selected: string[];
  onToggle: (code: string) => void;
};

export function NeighborhoodStep({ data, selected, onToggle }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (!data)
    return (
      <p className="max-w-xl text-lg text-mute">
        Start with{" "}
        <a href="#zip" className="font-medium text-accent-ink underline decoration-rule underline-offset-4 hover:decoration-accent">
          your church&rsquo;s ZIP code
        </a>{" "}
        at the top of the page. No ZIP? You can still add languages by hand in step 3.
      </p>
    );

  const groups = data.groups.filter((g) => g.speakers > 0);
  const shown = showAll ? groups : groups.slice(0, 6);
  const unit = figureDots(data.total, data.otherLanguages, data.limitedEnglish).unit;

  return (
    <div>
      <Figure key={data.zip} data={data} />

      <fieldset className="mt-14">
        <legend className="font-display text-2xl font-medium tracking-tight sm:text-3xl">Which languages will you publish in?</legend>
        <p className="mt-2 max-w-2xl text-mute">We ticked the ones where the most neighbors speak English less than very well. Change them as you see fit.</p>
        <ul className="mt-6 border-b border-rule">
          {shown.map((g, n) => {
            const all = dotsFor(g.speakers, unit);
            const lim = Math.min(all, dotsFor(g.limitedEnglish, unit));
            const moe = g.speakersMoe ? Math.min(40, dotsFor(g.speakersMoe, unit)) : 0;
            return (
              <li key={g.id} className="rise grid gap-4 border-t border-rule py-5 lg:grid-cols-12 lg:gap-8" style={{ "--i": n } as React.CSSProperties}>
                <div className="lg:col-span-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-xl font-medium">{g.label}</span>
                    {g.lowReliability ? (
                      <span className="chip chip-neutral" title="The margin of error is at least half the estimate.">
                        small sample, wide margin
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-mute tabular-nums">
                    {fmt(g.speakers)} people{g.speakersMoe !== null ? ` (±${fmt(g.speakersMoe)})` : ""} · {fmt(g.limitedEnglish)} speak English less than very well ({pct(g.limitedShare)})
                  </p>
                  {g.note ? <p className="mt-1 text-xs text-mute">{g.note}</p> : null}
                  {g.suggest.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {g.suggest.map((code) => {
                        const l = languageByCode(code)!;
                        const on = selected.includes(code);
                        return (
                          <label
                            key={code}
                            className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 text-sm font-medium transition-colors ${on ? "border-ink bg-ink text-white" : "border-rule bg-white hover:border-accent"}`}
                          >
                            <input type="checkbox" className="size-4 accent-[var(--gold-bright)]" checked={on} onChange={() => onToggle(code)} />
                            <span>{l.name}</span>
                            <span lang={code} dir={l.dir} className={on ? "text-white/70" : "text-mute"}>
                              {l.native}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div aria-hidden="true" className="dots content-start lg:col-span-6 lg:pt-2">
                  {Array.from({ length: all }, (_, i) => (
                    <i key={i} data-layer={i < lim ? "limited" : undefined} />
                  ))}
                  {Array.from({ length: moe }, (_, i) => (
                    <i key={`m${i}`} data-layer="moe" />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-mute">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-gold-bright" /> English less than very well
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-accent" /> Other speakers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full border-[1.5px] border-dotted border-ink/40" /> Margin of error
            </span>
          </span>
          {groups.length > 6 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
              {showAll ? "Show fewer" : `Show all ${groups.length} language groups`}
            </button>
          ) : null}
        </div>
      </fieldset>
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-mute">
        Source: US Census Bureau, American Community Survey {data.release.name} ({data.release.years}), table C16001, ZIP code tabulation area {data.zip}, read live via{" "}
        {data.source === "census.gov" ? (
          "api.census.gov"
        ) : (
          <a className="underline" href={`https://censusreporter.org/data/table/?table=C16001&geo_ids=86000US${data.zip}`}>
            Census Reporter
          </a>
        )}
        . Estimates have margins of error; small groups can be off by a lot.
      </p>
    </div>
  );
}
