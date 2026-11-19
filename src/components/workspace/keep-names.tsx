import { keepTitle } from "@/lib/words/titles";
import type { ReactNode } from "react";

/**
 * Says a line with every person's name in it kept whole: a name never breaks across lines,
 * so "Home visit with Renee Baptiste" wraps before "Renee", not between her names.
 */
export function nameKeeper(names: readonly string[]) {
  const whole = [...new Set(names.filter((name) => /\s/.test(name.trim())).map(keepTitle))].sort((a, b) => b.length - a.length);
  if (!whole.length) return (text: string): ReactNode => text;
  const pattern = new RegExp(`(${whole.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return (text: string): ReactNode => {
    const parts = text.split(pattern);
    if (parts.length === 1) return text;
    return parts.map((part, index) => (index % 2 ? <span className="live-name" key={index}>{part}</span> : part));
  };
}
