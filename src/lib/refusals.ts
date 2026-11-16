/**
 * Sentences the backend says to a member when it refuses their own act. The backend throws them
 * in English; the word tables carry the same sentence in Spanish and Creole, keyed by the English.
 */
export const refusals = {
  away: "You are marked away that day. Change your time off, or say you can’t take this one.",
  busy: "You already have a commitment at that time. Say you can’t take this one, or ask the coordinator to move it.",
} as const;
