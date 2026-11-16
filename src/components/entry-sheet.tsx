"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  foot,
  children,
}: {
  corner?: "rest" | "waits" | "given";
  /** Names the page written on the sheet; when it changes, the new lines arrive one after another. */
  page: string;
  /** A quiet way out, set at the right of the language line. */
  foot?: ReactNode;
  children: ReactNode;
}) {
  const [language, setLanguage] = useEntryLanguage();
  // A keyboard on a phone slides the view down the page without moving the page itself. The workspace shell
  // says how far as `--live-pan`; before anyone is signed in there is no shell, so the sheet says it, and the
  // paper strip over the status area follows the view down. No word is ever read behind the clock.
  useEffect(() => {
    const view = window.visualViewport;
    // The app's shell holds the status area natively (`data-shell="ios"`), so there is no strip to move.
    if (!view || document.documentElement.dataset.shell === "ios") return;
    const root = document.documentElement.style;
    const read = () => root.setProperty("--live-pan", `${Math.max(0, view.offsetTop)}px`);
    read();
    view.addEventListener("resize", read);
    view.addEventListener("scroll", read);
    return () => {
      view.removeEventListener("resize", read);
      view.removeEventListener("scroll", read);
      root.removeProperty("--live-pan");
    };
  }, []);
  // On iPhone and iPad the sheet follows the system's text size (Settings, Larger Text) up to 130%, by the
  // same measure the workspace shell uses once someone is signed in: the system's body size is 17px at
  // the standard setting, and every size is scaled by the same share. Elsewhere nothing changes.
  useEffect(() => {
    if (!CSS.supports("font", "-apple-system-body")) return;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body;-webkit-text-size-adjust:100%";
    document.body.append(probe);
    const root = document.documentElement.style;
    const fit = () => {
      const share = Math.min(1.3, Math.max(1, parseFloat(getComputedStyle(probe).fontSize) / 17));
      root.setProperty("-webkit-text-size-adjust", `${Math.round(share * 100)}%`);
      // Larger words need a line each: the sheet stops setting two things side by side (`data-entry-large`).
      document.documentElement.toggleAttribute("data-entry-large", share > 1.1);
    };
    fit();
    document.addEventListener("visibilitychange", fit);
    return () => {
      document.removeEventListener("visibilitychange", fit);
      root.removeProperty("-webkit-text-size-adjust");
      document.documentElement.removeAttribute("data-entry-large");
      probe.remove();
    };
  }, []);
  // A keyboard covers the foot of the screen. The page is given that much more room below (`--entry-keys`),
  // so it can truly scroll, and the form is moved by the least needed for its button to stand whole above
  // the keys while the field being typed in stays in view under the status area.
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const root = document.documentElement.style;
    let frame = 0;
    const settle = () => {
      const keys = Math.abs(view.scale - 1) < 0.01 ? Math.round(window.innerHeight - view.height) : 0;
      const up = keys > 120;
      root.setProperty("--entry-keys", `${up ? keys : 0}px`);
      cancelAnimationFrame(frame);
      const field = document.activeElement;
      if (!up || !(field instanceof HTMLElement) || !sheet.current?.contains(field)) return;
      const button = field.closest("form")?.querySelector('button[type="submit"]');
      if (!button) return;
      // After the new room below has been laid out.
      frame = requestAnimationFrame(() => {
        const inset = parseFloat(getComputedStyle(sheet.current ?? field).getPropertyValue("--entry-top")) || 0;
        const over = button.getBoundingClientRect().bottom + 12 - (view.offsetTop + view.height);
        const room = (field.closest(".live-field") ?? field).getBoundingClientRect().top - (view.offsetTop + inset + 8);
        const by = Math.min(over, room);
        if (by < 1) return;
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollBy({ top: by, behavior: still ? "auto" : "smooth" });
      });
    };
    view.addEventListener("resize", settle);
    document.addEventListener("focusin", settle);
    return () => {
      cancelAnimationFrame(frame);
      view.removeEventListener("resize", settle);
      document.removeEventListener("focusin", settle);
      root.removeProperty("--entry-keys");
    };
  }, []);
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
      <main ref={sheet} className="entry-sheet paper-settle">
        <div className={cn("entry-paper paper-corner", corner === "given" ? "paper-fold" : corner === "waits" && "paper-waits")}>
          <div key={page} className="entry-page paper-rows">
            {children}
          </div>
          <div className="entry-foot-line">
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
          {foot}
          </div>
        </div>
      </main>
    </div>
  );
}
