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
  | { type: "retryMeetingFanout"; meetingId: Id<"meetings"> };
export type LiveConfirmation = {
  title: string;
  body: string;
  command: LiveCommand;
};
