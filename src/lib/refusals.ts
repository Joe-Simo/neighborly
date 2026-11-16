/**
 * Sentences the backend says to a member when it refuses their own act. The backend throws them
 * in English; the word tables carry the same sentence in Spanish and Creole, keyed by the English.
 */
export const refusals = {
  away: "You are marked away that day. Change your time off, or say you can’t take this one.",
  busy: "You already have a commitment at that time. Say you can’t take this one, or ask the coordinator to move it.",
  // Thrown as plain sentences elsewhere in the backend (workspace.ts, pages.ts); keep each word for word with its source.
  changed: "This commitment changed. Review it again.",
  changedOrStarted: "The commitment changed or has already started. Review it again.",
  askNew: "This commitment changed or has already started. Ask the coordinator for a new request.",
  unavailable: "Request unavailable.",
  notEligible: "You are no longer eligible for this request.",
  pending: "A request is already pending.",
  notOpen: "Commitment is no longer open.",
  onlyAccepter: "Only the person who accepted can release this commitment.",
  datesChanged: "Your commitments changed. Review the affected dates again.",
  reviewFirst: "Review affected commitments before confirming time off.",
  dateRange: "Choose a valid date range.",
  endAfterStart: "End must be after start.",
  noCommitment: "Commitment not found.",
  noTimeOff: "Time off not found.",
  noAvailability: "Availability not found.",
  noTeamInvitation: "Team invitation not found.",
  noMeetingInvitation: "Meeting invitation not found.",
} as const;
