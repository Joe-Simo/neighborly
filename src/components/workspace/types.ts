import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type LiveWorkspaceData = FunctionReturnType<
  typeof api.workspace.dashboard
>;
export type LiveCommitment = LiveWorkspaceData["commitments"][number];
export type LiveCommand =
  | FunctionArgs<typeof api.workspace.execute>["command"]
  | { type: "revokeInvitation"; invitationId: Id<"invitations"> }
  | { type: "retryMeetingFanout"; meetingId: Id<"meetings"> }
  | { type: "revokePartner"; partnerId: Id<"webPartners"> };
export type LiveConfirmation = {
  title: string;
  body: string;
  /** The button's words: the act itself ("Cancel commitment"). Required, so no dialog can fall back to a bare "Confirm". */
  action: string;
  command: LiveCommand;
  /** The line said once it is done, naming who or what changed. */
  done: string;
  /** "Go back" returns here (the sheet the step was taken from) rather than closing everything. */
  onBack?: () => void;
};
