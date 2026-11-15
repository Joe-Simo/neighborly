import { ConvexError } from "convex/values";

/**
 * The family's words in English, for the places that stand outside the workspace and its language
 * tables (the error page, the not-found page). Inside a room, read `words.states`.
 */
export const stateWords = {
  notSaved: "That couldn’t be saved. Please try again.",
  offlineSave: "There is no connection right now, so this was not saved.",
  kept: "Nothing was saved, and what you typed is still here.",
  tryAgain: "Try again",
  waiting: "Waiting for the connection. What you typed is kept and will be sent when it returns.",
  offlineTitle: "No connection right now.",
  offlineDeck: "What is on screen is kept. Changes will be sent when this device is back online.",
  back: "The connection is back.",
  errorTitle: "This room didn’t open.",
  errorDeck: "Nothing is lost. Try again; if it still won’t open, the rest of your workspace is in the menu.",
  privateTitle: "Kept private.",
  privateDeck: "This room names the neighbors we help, so it is open to coordinators only. Your commitments and your team are where they always are.",
  privateAction: "My commitments",
  missingTitle: "This page isn’t here.",
  missingDeck: "The address may be old or mistyped. Your workspace is where you left it.",
  missingAction: "Go to your workspace",
} as const;

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
