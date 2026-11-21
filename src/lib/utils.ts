import { createCn } from "cn/engine";
import tables from "@/lib/cn-tables";

// Class merging fitted to the classes this project uses (`cn build`, run by withCn in next.config.ts on every build and
// dev start): the full Tailwind tables cost every page about 7 KB gz; these hold only the class groups found in src.
export const cn = createCn(tables);

/** A line someone typed, ended with one full stop whether or not they typed one. */
export function sentence(line: string) {
  const text = line.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
