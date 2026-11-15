"use client";

import { createContext, useContext } from "react";
import type { LiveArea } from "@/components/workspace/areas";
import type { ActionKind } from "@/components/workspace/navigation";
import type {
  LiveCommand,
  LiveCommitment,
  LiveConfirmation,
  LiveWorkspaceData,
} from "@/components/workspace/types";

export type Workspace = {
  area: LiveArea;
  data: LiveWorkspaceData;
  requestCommitments: LiveWorkspaceData["commitments"];
  ownPerson: LiveWorkspaceData["people"][number] | undefined;
  isOwner: boolean;
  pending: boolean;
  now: number;
  teamFilter: string;
  setTeamFilter: (teamId: string) => void;
  format: (time: number, options?: Intl.DateTimeFormatOptions) => string;
  when: (start: number, end: number) => string;
  personName: (id: string | null) => string;
  teamName: (id: string) => string;
  perform: (command: LiveCommand, success?: string) => Promise<boolean>;
  openAction: (kind: ActionKind) => void;
  showCommitment: (item: LiveCommitment, trigger: HTMLButtonElement) => void;
  confirm: (confirmation: LiveConfirmation) => void;
  focusOutcome: () => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);
export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace)
    throw new Error("useWorkspace must be used inside the workspace shell.");
  return workspace;
}
