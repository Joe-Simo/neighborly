"use client";

import { createContext, useContext } from "react";
import type { LiveArea } from "@/components/workspace/areas";
import type {
  ActionKind,
  LiveHeadingOverride,
} from "@/components/workspace/navigation";
import type {
  LiveCommand,
  LiveCommitment,
  LiveConfirmation,
  LiveWorkspaceData,
} from "@/components/workspace/types";
import type { Words } from "@/lib/words";

/** The one button a help room puts in the page head, such as "Log a call". */
/**
 * quiet draws it in the outline style. Set it while a sheet with its own filled button
 * is on screen, so the screen never has two filled buttons.
 * plus shows the plus icon: only where the button adds a thing (Log a call, Add a neighbor).
 */
export type LiveHeadAction = { label: string; run: () => void; quiet?: boolean; plus?: boolean };

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
  /** Every phrase the screens show, in this person's language and this group's word set. */
  words: Words;
  /**
   * Replaces the page head while a section shows one record, such as a neighbor by name.
   * Call it in a layout effect and pass null in the cleanup, so the area's heading returns.
   */
  setHeading: (heading: LiveHeadingOverride | null) => void;
  /**
   * Puts the section's own primary button in the page head. Call it in a layout effect and
   * pass null in the cleanup. A view with no primary action, such as one record, sets none.
   */
  setHeadAction: (action: LiveHeadAction | null) => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);
export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace)
    throw new Error("useWorkspace must be used inside the workspace shell.");
  return workspace;
}

/** The workspace where there is one, null outside the shell (sign-in, welcome, a page of its own). */
export function useWorkspaceIfAny() {
  return useContext(WorkspaceContext);
}
