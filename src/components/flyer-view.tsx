"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { flyer, NotApproved, type PublishedLanguage } from "@/lib/publish";
import { attribution } from "@/lib/scripture";
import { loadWorkspace, publishState } from "@/lib/workspace";

/** Reads the workspace saved in this browser and rebuilds the same export gate as the publish step. */
function useFlyer(code: string): { flyer: PublishedLanguage } | { locked: string } {
  return useMemo(() => {
    const state = publishState(loadWorkspace());
    if (state.blockedReason) return { locked: state.blockedReason };
    try {
      return { flyer: flyer(state.source, state.reviews, code) };
    } catch (e) {
      if (e instanceof NotApproved) return { locked: e.message };
      throw e;
    }
  }, [code]);
}

export function FlyerView() {
  const code = useSearchParams().get("lang") ?? "en";
  const r = useFlyer(code);

  if ("locked" in r) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <div className="card p-6">
          <p className="font-display text-2xl font-semibold">
            <span aria-hidden="true">🔒 </span>This flyer is locked
          </p>
          <p className="mt-2 text-mute">{r.locked}</p>
          <p className="mt-2 text-mute">Flyers print only after a named reviewer approves every block in every language, the same rule as the other exports.</p>
          <Link href="/#publish" className="btn btn-primary mt-5">
            Back to the workspace
          </Link>
        </div>
      </main>
    );
  }

  const f = r.flyer;
  // Keep it to one page: longer announcements print smaller.
  const size = [f.title, ...f.paragraphs, ...f.verses.map((v) => v.text)].join("").length;
  const body = size > 1800 ? "text-sm" : size > 1300 ? "text-base" : size > 850 ? "text-lg" : "text-xl";
  const head = size > 1300 ? "text-3xl" : size > 850 ? "text-4xl" : "text-5xl";
  const verse = size > 1300 ? "text-lg" : "text-2xl";
  return (
    <>
      <div className="no-print sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link href="/#publish" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
              Back to the workspace
            </Link>
            <p className="text-sm text-mute">Letter size, one page. Choose &ldquo;Save as PDF&rdquo; in the print dialog for a file.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Print this flyer
          </button>
        </div>
      </div>
      <main id="main" className="flyer-sheet mx-auto my-6 max-w-3xl bg-white px-8 py-10 shadow-sm sm:px-14 sm:py-14 print:m-0 print:max-w-none print:p-0 print:shadow-none">
        <article lang={f.code} dir={f.dir} className="flex min-h-[9.4in] flex-col print:min-h-[9.8in]">
          <div className="h-2 w-24 rounded-full bg-accent" aria-hidden="true" />
          <h1 className={`font-display mt-6 ${head} leading-tight font-semibold tracking-tight text-ink`}>{f.title}</h1>
          <div className={`mt-6 grid gap-4 ${body} leading-relaxed`}>
            {f.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {f.verses.map((v, i) => (
            <blockquote key={i} className="mt-8 rounded-2xl border border-gold/50 bg-gold-soft px-6 py-5">
              <p className={`font-display ${verse} leading-relaxed`}>&ldquo;{v.text}&rdquo;</p>
              <p className="mt-2 text-base text-mute">{attribution(v)}</p>
            </blockquote>
          ))}
          <footer className="mt-auto border-t border-line pt-5 text-base text-mute">
            {f.disclosure ? <p>{f.disclosure}</p> : null}
            {f.reviewer ? (
              <p className="mt-1" lang="en" dir="ltr">
                Reviewed by {f.reviewer}
              </p>
            ) : null}
          </footer>
        </article>
      </main>
    </>
  );
}
