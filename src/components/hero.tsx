import type { ReactNode } from "react";
import type { NeighborhoodLanguages } from "@/lib/census";
import { isLatin } from "@/lib/language-style";
import { TARGET_LANGUAGES } from "@/lib/languages";
import { Street } from "./street";

type Word = { code: string; text: string; dir: "ltr" | "rtl"; size: number; tone: "ink" | "accent" | "gold" | "quiet" };

/** Before a ZIP: every language we can publish in, set in a fixed rhythm. */
const RHYTHM = [3.4, 1.5, 2.2, 1.2, 1.7, 2.6, 1.3, 2.9, 2, 1.6, 3.2, 1.4, 2.3, 1.5, 2.5];
const TONES: Word["tone"][] = ["ink", "quiet", "accent", "quiet", "quiet", "gold", "quiet", "ink", "quiet", "accent", "ink", "quiet", "quiet", "gold", "quiet"];

function words(data: NeighborhoodLanguages | null, selected: string[]): Word[] {
  if (!data) return TARGET_LANGUAGES.map((l, i) => ({ code: l.code, text: l.welcome, dir: l.dir, size: RHYTHM[i % RHYTHM.length], tone: TONES[i % TONES.length] }));
  // After a ZIP: only the languages this neighborhood speaks, sized by how many neighbors speak them.
  const groups = data.groups.filter((g) => g.speakers > 0 && g.suggest.length);
  const max = Math.max(1, ...groups.map((g) => g.speakers));
  return groups.flatMap((g) =>
    g.suggest.map((code, k) => {
      const l = TARGET_LANGUAGES.find((x) => x.code === code)!;
      const on = selected.includes(code);
      return { code, text: l.welcome, dir: l.dir, size: (1.25 + 3 * Math.sqrt(g.speakers / max)) * (k === 0 ? 1 : 0.7), tone: on ? (k === 0 && g.speakers === max ? "gold" : "ink") : "quiet" } satisfies Word;
    }),
  );
}

export function Hero({ data = null, selected = [], children }: { data?: NeighborhoodLanguages | null; selected?: string[]; children?: ReactNode }) {
  const list = words(data, selected);
  return (
    <section className="pt-10 sm:pt-16" aria-labelledby="hero-title">
      <p className="label text-accent">For church volunteers</p>
      <h1 id="hero-title" className="hero-title mt-5">
        <span className="lift"><span style={{ "--i": 0 } as React.CSSProperties}>Invite your neighbors</span></span>
        <span className="lift"><span style={{ "--i": 1 } as React.CSSProperties}>in the languages</span></span>
        <span className="lift"><span style={{ "--i": 2 } as React.CSSProperties}>they speak <em>at home.</em></span></span>
      </h1>

      <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="max-w-md text-lg leading-relaxed text-mute">
            Neighborly reads the Census for the languages around your church, drafts your announcement in each one, checks every time and address by code, and waits for a fluent volunteer to sign every line.
          </p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="lg:col-span-7 lg:pl-8">
          <p className="label mb-3 text-mute lg:text-right">{data ? `Welcome, as ${data.zip} says it` : "Welcome, in 15 languages"}</p>
          <p className="sr-only">
            {data ? "The word welcome in the languages spoken around this ZIP code, larger where more neighbors speak them." : "The word welcome in each language Neighborly can publish in."}
          </p>
          <div key={data?.zip ?? "all"} aria-hidden="true" className="chorus lg:justify-end">
            {list.map((w, i) => (
              <span key={w.code} lang={w.code} dir={w.dir} data-tone={w.tone} className={`chorus-word ${isLatin(w.text) ? "font-display italic" : "font-semibold"}`} style={{ "--s": w.size, "--i": i } as React.CSSProperties}>
                <span>{w.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <Street className="mt-12 block h-auto w-full sm:mt-16" />
    </section>
  );
}
