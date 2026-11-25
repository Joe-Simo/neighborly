import {
  CalendarDays,
  Check,
  ClipboardList,
  HeartHandshake,
  Users,
  UserRound,
  Umbrella,
  Phone,
  House,
  Landmark,
  Footprints,
  ChartNoAxesColumn,
  Folder,
} from "lucide-react";
import type { LiveArea } from "@/components/workspace/areas";
import type { ReliefName } from "@/components/workspace/relief";

export const navigation = [
  // Grouped by the work: the week, then the help-side rooms a conference lives in each day, then its people.
  // group starts a new cluster in the side menu (a quiet gap, no heading).
  { id: "week", label: "This week", icon: CalendarDays },
  // Only for people who lead the group: every function behind these rooms needs a coordinator or owner
  // (convex/access.ts, neighborAccess). A member's own visits are in My commitments.
  { id: "help-line", label: "Help line", icon: Phone, leadersOnly: true, group: true },
  { id: "neighbors", label: "Neighbors", icon: House, leadersOnly: true },
  { id: "visits", label: "Home visits", icon: Footprints, leadersOnly: true },
  { id: "treasury", label: "Treasury", icon: Landmark, leadersOnly: true },
  { id: "reports", label: "Reports", icon: ChartNoAxesColumn, leadersOnly: true },
  { id: "team", label: "Teams", icon: Users, group: true },
  { id: "people", label: "People", icon: UserRound },
  { id: "commitments", label: "Commitments", icon: HeartHandshake },
  { id: "mine", label: "My commitments", icon: Check },
  { id: "time-off", label: "Time off", icon: Umbrella },
  { id: "tasks", label: "Tasks & meetings", icon: ClipboardList },
  { id: "tools", label: "Your files", icon: Folder, leadersOnly: true, group: true },
] as const;

export type ActionKind =
  | "team"
  | "invite"
  | "commitment"
  | "timeOff"
  | "task"
  | "meeting"
  | "announcement";
export const actionTitles: Record<ActionKind, string> = {
  team: "Create a team",
  invite: "Invite someone",
  commitment: "Add a commitment",
  timeOff: "Plan time off",
  task: "Add a task",
  meeting: "Plan a meeting",
  announcement: "Share an announcement",
};
/** The head button of the volunteer areas. Help rooms have none; each carries its own in the section. */
export const primaryActions: Partial<Record<LiveArea, ActionKind>> = {
  week: "announcement",
  team: "team",
  people: "invite",
  commitments: "commitment",
  mine: "announcement",
  "time-off": "timeOff",
  tasks: "task",
};
/**
 * room "help" marks the help-side rooms, which use the shared help.css styles.
 * art is the room's paper relief picture in the page head; focus is the point of it kept in view
 * beside the words, and band (0 top to 1 bottom, 0.5 unless given) is where the phone's band looks.
 */
export type LiveHeading = {
  title: string;
  deck?: string;
  room?: "help";
  art: { picture: ReliefName; focus?: string; band?: number };
};
/** What a section may put in the page head in place of its area's heading. The room's picture stays unless plain. */
export type LiveHeadingOverride = Pick<LiveHeading, "title" | "deck"> & {
  /** A private record's head (one neighbor by name) is words only: no painting. */
  plain?: boolean;
  /** The way back from an inner view, drawn as a quiet link above the eyebrow, such as "Ledger". */
  back?: { label: string; run: () => void };
};
export const headings: Record<LiveArea, LiveHeading> = {
  week: {
    title: "This week",
    art: { picture: "week", band: 0.8 },
  },
  team: {
    title: "Teams",
    art: { picture: "teams" },
  },
  people: {
    title: "People",
    art: { picture: "people" },
  },
  commitments: {
    title: "Commitments",
    art: { picture: "commitment" },
  },
  mine: {
    title: "My commitments",
    art: { picture: "mine" },
  },
  "time-off": {
    title: "Time off",
    art: { picture: "rest", band: 0.2 },
  },
  tasks: {
    title: "Tasks & meetings",
    art: { picture: "tasks" },
  },
  "help-line": {
    title: "Help line",
    art: { picture: "call", band: 0.42 },
    room: "help",
  },
  neighbors: {
    title: "Neighbors",
    art: { picture: "neighbors" },
    room: "help",
  },
  treasury: {
    title: "Treasury",
    art: { picture: "help" },
    room: "help",
  },
  reports: {
    title: "Reports",
    art: { picture: "year", band: 0.85 },
    room: "help",
  },
  visits: {
    title: "Home visits",
    art: { picture: "visit", band: 0.6 },
    room: "help",
  },
  tools: {
    title: "Your files",
    art: { picture: "files" },
    room: "help",
  },
};
