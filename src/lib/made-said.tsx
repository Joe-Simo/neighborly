import { Fragment, type ReactNode } from "react";
import type { Language } from "@/lib/words";

/** Each language's own way of writing a number: "1,586" and "0.85" in English, "1586" and "0,85" in Spanish. */
export const madeNumber = { en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }), es: new Intl.NumberFormat("es", { maximumFractionDigits: 2 }) } as const;
// The other page's name is a title, so it is set as one wherever a sentence names it.
const named = { en: "A week", es: "Una semana" } as const;

/** A sentence as the reader sees it: each {#0.85} written in the page's own numbers, and the named page set as a title. */
export function madeSaid(text: string, language: Language): ReactNode {
  const numbered = text.replace(/\{#([\d.]+)\}/g, (_, value: string) => madeNumber[language].format(Number(value)));
  const parts = numbered.split(named[language]);
  if (parts.length === 1) return numbered;
  return parts.map((part, index) => <Fragment key={index}>{index > 0 && <cite className="public-made-named">{named[language]}</cite>}{part}</Fragment>);
}
