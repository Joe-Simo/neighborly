import { ConvexError } from "convex/values";

import { stateWords } from "./state-words";
export { stateWords };

/** The form controls a browser's own check can refuse (a fieldset can be `:invalid` too, and is not one). */
export const wrongControl = "input:invalid, select:invalid, textarea:invalid";

// A development server sends the thrown sentence after these words; production sends it only inside a ConvexError.
const thrown = /Uncaught (?:Convex)?Error:\s*(.+)/;

/**
 * The sentence to show when a save or a load is refused. It is the backend's own plain
 * sentence when there is one, calm words when there is not, and never the raw error.
 */
export function readFailure(
  cause: unknown,
  fallback: string = stateWords.notSaved,
  offline: string = stateWords.offlineSave,
): string {
  if (cause instanceof ConvexError && typeof cause.data === "string") return cause.data;
  const sentence = cause instanceof Error ? thrown.exec(cause.message)?.[1] : undefined;
  if (sentence) return sentence.split("\n")[0].trim();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return offline;
  return fallback;
}
