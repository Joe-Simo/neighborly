import Link from "next/link";
import { preload } from "react-dom";
import type { Language } from "@/lib/words";

const names: Record<Language, string> = { en: "English", es: "Español" };

/** The page in its other language, named in that language. Followed, the same page turns over to it (public-turn.tsx). */
export function PublicLanguage({ language, paths }: { language: Language; paths: Record<Language, string> }) {
  const other: Language = language === "en" ? "es" : "en";
  // The page's text face is asked for with the page, as the app does: arriving late, it would move this right-hand link by a few pixels.
  preload("/fonts/source-sans-3-latin-variable.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <Link className="public-page-language" href={paths[other]} hrefLang={other} lang={other}>{names[other]}</Link>;
}
