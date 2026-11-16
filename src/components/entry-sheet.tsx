"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { languageNames, languages } from "@/lib/words";
import { cn } from "@/lib/utils";
import { authWords, useEntryLanguage } from "./live-auth-words";
import "./live-auth.css";

/**
 * The door fills the whole wall here, so it is asked for larger than a room's head ever is:
 * a wide desktop shows it edge to edge, an upright iPad at the screen's own width.
 */
const doorSources = (type: "avif" | "webp") =>
  [640, 1024, 1536, 2400].map((width) => `/assets/relief/relief-visit-${width}.${type} ${width}w`).join(", ");
const doorSizes = "(max-width: 699px) 228px, (max-width: 1100px) and (orientation: portrait) 100vw, max(100vw, 150vh)";

/**
 * The way in, before anyone stands in a workspace: one sheet of paper beside the relief of a hand
 * at a green door. Sign-in and the first welcome are both written on it. Its folded corner follows
 * the rule of every room: plain at rest, ochre while it waits for the person, green once the answer is yes.
 */
export function EntrySheet({
  corner = "rest",
  page,
  children,
}: {
  corner?: "rest" | "waits" | "given";
  /** Names the page written on the sheet; when it changes, the new lines arrive one after another. */
  page: string;
  children: ReactNode;
}) {
  const [language, setLanguage] = useEntryLanguage();
  return (
    <div className="entry" lang={language}>
      <div className="entry-art" aria-hidden="true">
        <picture className="relief">
          <source type="image/avif" srcSet={doorSources("avif")} sizes={doorSizes} />
          <source type="image/webp" srcSet={doorSources("webp")} sizes={doorSizes} />
          <img
            src="/assets/relief/relief-visit-1536.webp"
            alt=""
            width={1536}
            height={1024}
            decoding="async"
            style={{ objectPosition: "var(--entry-focus)" }}
          />
        </picture>
      </div>
      <main className="entry-sheet paper-settle">
        <div className={cn("entry-paper paper-corner", corner === "given" ? "paper-fold" : corner === "waits" && "paper-waits")}>
          <div key={page} className="entry-page paper-rows">
            {children}
          </div>
          <div className="entry-languages" role="group" aria-label={authWords[language].language}>
            {languages.map((choice) => (
              <Button
                key={choice}
                variant="link"
                lang={choice}
                aria-pressed={choice === language}
                onClick={() => setLanguage(choice)}
              >
                {languageNames[choice]}
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
