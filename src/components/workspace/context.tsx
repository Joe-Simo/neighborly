"use client";

import type { ReactNode } from "react";
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
 * unsettled is true while the room is still finding out which style the button takes (its data has not
 * arrived). The button keeps its place and is not drawn, so it arrives once, in its final style.
 */
export type LiveHeadAction = { label: string; run: () => void; quiet?: boolean; plus?: boolean; unsettled?: boolean };

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
  /** `undo` puts a way back on the saved line: the command that reverses this one, and what to say once it has. */
  perform: (command: LiveCommand, success?: string, undo?: { command: LiveCommand; said: string; returnTo?: HTMLElement }) => Promise<boolean>;
  /**
   * Lays the workspace's saved line with a way back on it, for an act a room took itself and then left (a visit
   * called off from its own page). The line stays ten seconds, and as long as a hand or the focus is on it.
   * With no `back`, the line only says what was done: for an act that cannot be taken back.
   */
  offerUndo: (said: string, back?: WayBack) => void;
  openAction: (kind: ActionKind) => void;
  showCommitment: (item: LiveCommitment, trigger: HTMLButtonElement) => void;
  confirm: (confirmation: LiveConfirmation) => void;
  focusOutcome: () => void;
  /** One of the sample conference's own names, titles or places, said in this reader's language; anyone else's typed words come back as typed. For the screen only, never for a form's value. */
  sampleSaid: (typed: string) => string;
  /** A line with every member's name in it kept whole, so no name breaks across lines. For the screen only. */
  keepNames: (text: string) => ReactNode;
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

/** The reverse of an act just taken, and what the line says once it has run. */
export type WayBack = { run: () => Promise<unknown>; said: string; returnTo?: HTMLElement };

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
