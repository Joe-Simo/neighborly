/**
 * The family's words in English, for the places that stand outside the workspace and its language
 * tables (the error page, the not-found page). Inside a room, read `words.states`.
 */
export const stateWords = {
  notSaved: "That couldn’t be saved. Try again.",
  offlineSave: "There is no connection right now, so this was not saved.",
  kept: "Nothing was saved, and what you typed is still here.",
  tryAgain: "Try again",
  waiting: "Waiting for the connection. What you typed is kept and will be sent when it returns.",
  offlineTitle: "No connection right now.",
  offlineRoom: "This room opens when it returns.",
  offlineDeck: "What is on screen is kept. Changes will be sent when this device is back online.",
  back: "The connection is back.",
  errorTitle: "This room didn’t open.",
  errorDeck: "Nothing is lost. Try again; if it still won’t open, the other rooms are in the menu.",
  privateTitle: "Kept private.",
  privateDeck: "This room names the neighbors we help, so it is open to coordinators only. Your commitments and your team are where they always are.",
  privateAction: "My commitments",
  missingTitle: "This page isn’t here.",
  missingDeck: "The address may be old or mistyped. Everything is where you left it.",
  missingAction: "Open Kind Helps",
  launchTitle: "We couldn’t open your conference.",
  launchDeck: "Nothing was lost. Try again in a moment.",
  needed: "Fill this in.",
  neededChoice: "Choose one.",
  neededCheck: "Look at this again.",
} as const;
