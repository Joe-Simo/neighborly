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
  { id: "week", label: "This week", icon: CalendarDays },
  { id: "team", label: "Teams", icon: Users },
  { id: "people", label: "People", icon: UserRound },
  { id: "commitments", label: "Commitments", icon: HeartHandshake },
  { id: "mine", label: "My commitments", icon: Check },
  { id: "time-off", label: "Time off", icon: Umbrella },
  { id: "tasks", label: "Tasks & meetings", icon: ClipboardList },
  { id: "help-line", label: "Help line", icon: Phone },
  { id: "neighbors", label: "Neighbors", icon: House },
  { id: "visits", label: "Home visits", icon: Footprints },
  { id: "treasury", label: "Treasury", icon: Landmark },
  { id: "reports", label: "Reports", icon: ChartNoAxesColumn },
  // Only for people who lead the group: every part of it needs a coordinator or owner.
  { id: "tools", label: "Your files", icon: Folder, leadersOnly: true },
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
 * art is the room's paper relief picture in the page head; focus is the point of it kept in view.
 */
export type LiveHeading = {
  title: string;
  deck: string;
  room?: "help";
  art: { picture: ReliefName; focus?: string };
};
/** What a section may put in the page head in place of its area's heading. The room's picture stays. */
export type LiveHeadingOverride = Pick<LiveHeading, "title" | "deck">;
export const headings: Record<LiveArea, LiveHeading> = {
  week: {
    title: "Good work, this week.",
    deck: "Your commitments, shared plans and the things to know.",
    art: { picture: "week" },
  },
  team: {
    title: "A place on the team.",
    deck: "People belong here, even when their plans change.",
    art: { picture: "people", focus: "38% 50%" },
  },
  people: {
    title: "People, together.",
    deck: "Your community and the teams they make possible.",
    art: { picture: "people", focus: "82% 50%" },
  },
  commitments: {
    title: "Clear commitments.",
    deck: "See what’s covered, what’s open and what’s awaiting a reply.",
    art: { picture: "commitment" },
  },
  mine: {
    title: "Your part in it.",
    deck: "What you’ve accepted, with the preparation to feel ready.",
    art: { picture: "commitment", focus: "62% 40%" },
  },
  "time-off": {
    title: "Room for life.",
    deck: "Keep your team informed while you take time away.",
    art: { picture: "rest" },
  },
  tasks: {
    title: "The little things matter.",
    deck: "Shared tasks and meetings, each with a clear next step.",
    art: { picture: "tasks" },
  },
  "help-line": {
    title: "Every call, returned.",
    deck: "Messages from the help line, and who is calling back.",
    art: { picture: "call" },
    room: "help",
  },
  neighbors: {
    title: "Neighbors, by name.",
    deck: "Each household and the help it has received, kept private.",
    art: { picture: "neighbors" },
    room: "help",
  },
  treasury: {
    title: "Every gift, cared for.",
    deck: "What came in, what went out, and what it paid for.",
    art: { picture: "help" },
    room: "help",
  },
  reports: {
    title: "The year, added up.",
    deck: "Counts for your council's yearly report, ready to print.",
    art: { picture: "year" },
    room: "help",
  },
  visits: {
    title: "Two by two.",
    deck: "Home visits, the pair who are going, and what they found.",
    art: { picture: "visit" },
    room: "help",
  },
  tools: {
    title: "Bring records in. Take them with you.",
    deck: "From ServWare or a spreadsheet, and back out again whenever you like.",
    art: { picture: "files" },
    room: "help",
  },
};
