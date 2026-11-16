export { cn } from "cn"

/** A line someone typed, ended with one full stop whether or not they typed one. */
export function sentence(line: string) {
  const text = line.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
