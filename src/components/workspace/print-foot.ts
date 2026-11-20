/** A CSS string, quoted for `content`, on one line. */
const quoted = (text: string) => `"${text.replace(/[\\"]/g, "\\$&").replace(/\s+/g, " ")}"`;

const type = `font: 9pt "Source Sans 3", "Source Sans 3 Fallback", sans-serif; font-feature-settings: "lnum" 1, "tnum" 1; color: #000;`;

/**
 * The foot of every printed page, set in the page margin so it never covers a line: whose record it is on the left,
 * the day it was printed and "page 2 of 5" on the right. `pageWords` is one sentence with {page} and {pages} in it;
 * the printer puts its own two counters where the places are. Pages are the named @page rules to foot ("" is every page).
 */
export function printFoot({ pages, left, printed, pageWords, margin }: { pages: string[]; left: string; printed: string; pageWords: string; margin?: string }) {
  const [before = "", between = "", after = ""] = pageWords.split(/\{pages?\}/);
  const count = `${quoted(`${printed} · ${before}`)} counter(page) ${quoted(between)} counter(pages)${after ? ` ${quoted(after)}` : ""}`;
  const boxes = `@bottom-left { content: ${quoted(left)}; ${type} } @bottom-right { content: ${count}; ${type} }`;
  return `@media print { ${pages.map((page) => `@page ${page} { ${margin ? `margin: ${margin}; ` : ""}${boxes} }`).join(" ")} }`;
}
