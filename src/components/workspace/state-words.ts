/**
 * The family's words in English, for the places that stand outside the workspace and its language
 * tables (the error page, the not-found page). Inside a room, read `words.states`.
 */
export const stateWords = {
  notSaved: "That couldn’t be saved. Try again.",
  offlineSave: "No connection right now, so this wasn’t saved.",
  kept: "Nothing was saved, and what you typed is still here.",
  tryAgain: "Try again",
  waiting: "Waiting for the connection. What you typed is kept and will be sent when it returns.",
  offlineTitle: "No connection right now.",
  offlineRoom: "This room opens when it returns.",
  offlineDeck: "What’s on screen stays. Your changes go out once this device is back online.",
  errorTitle: "This room didn’t open.",
  errorDeck: "Nothing is lost. Try again; if it still won’t open, the other rooms are in the menu.",
  privateTitle: "Kept private.",
  privateDeck: "This room is made from the records of the neighbors we help, so only coordinators open it. Your commitments and your team are where they always are.",
  privateDeckTools: "This room brings records in from a file and downloads them all, including the neighbors’ private details, so it opens to the group’s owner and coordinators only. Your commitments and your team are where they always are.",
  privateDeckTreasury: "This room holds the group’s money and who it paid, so only coordinators open it. Your commitments and your team are where they always are.",
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
