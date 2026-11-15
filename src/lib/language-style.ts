import type { CSSProperties } from "react";

/** A soft ground and a deep ink per language, so each one reads as its own place. All pairs pass WCAG AA for text. */
const TINTS: Record<string, [soft: string, deep: string]> = {
  es: ["#f6e3d8", "#9a3d1f"],
  ht: ["#f8e9c9", "#7d5200"],
  fr: ["#e1e8f5", "#2f4f8f"],
  de: ["#ece6da", "#5b4a2e"],
  ru: ["#efe0ea", "#7a2f63"],
  uk: ["#dfecf5", "#1f5d86"],
  pl: ["#f5dfe0", "#96303a"],
  pt: ["#e2efd9", "#3d6b2a"],
  hi: ["#fbe6d0", "#994a0a"],
  ko: ["#e3ecec", "#24595c"],
  "zh-Hans": ["#f7dedb", "#a12a22"],
  "zh-Hant": ["#f3e1e6", "#8c2c4c"],
  vi: ["#e6f0dc", "#456b1d"],
  tl: ["#e0eef2", "#1e6276"],
  ar: ["#e4efe6", "#1f6a4a"],
};

export function languageTint(code: string): CSSProperties {
  const [soft, deep] = TINTS[code] ?? ["#e3f1ef", "#0a4f4b"];
  return { "--tint": soft, "--tint-ink": deep } as CSSProperties;
}

/** Scripts that have no italic or serif partner in our type system are set upright in the sans. */
export const isLatin = (text: string) => /^[\p{Script=Latin}\s'’-]+$/u.test(text);
