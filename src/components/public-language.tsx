import Link from "next/link";
import type { Language } from "@/lib/words";

const names: Record<Language, string> = { en: "English", es: "Español" };

/** The page in its other language, named in that language. Followed, the page is turned over to it (public-turn.tsx). */
export function PublicLanguage({ language, paths }: { language: Language; paths: Record<Language, string> }) {
  const other: Language = language === "en" ? "es" : "en";
  return <Link className="public-page-language" href={paths[other]} hrefLang={other} lang={other}>{names[other]}</Link>;
}
