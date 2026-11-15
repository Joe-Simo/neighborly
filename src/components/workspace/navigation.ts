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
 * art is a crop of an approved painting in the page head; only art already in public/assets.
 */
export type LiveHeading = {
  title: string;
  deck: string;
  room?: "help";
  art?: { src: string; position: string; size?: string };
};
/** What a section may put in the page head in place of its area's heading. No art unless it gives one. */
export type LiveHeadingOverride = Pick<LiveHeading, "title" | "deck" | "art">;
export const headings: Record<LiveArea, LiveHeading> = {
  week: {
    title: "Good work, this week.",
    deck: "Your commitments, shared plans and the things to know.",
  },
  team: {
    title: "A place on the team.",
    deck: "People belong here, even when their plans change.",
  },
  people: {
    title: "People, together.",
    deck: "Your community and the teams they make possible.",
  },
  commitments: {
    title: "Clear commitments.",
    deck: "See what’s covered, what’s open and what’s awaiting a reply.",
  },
  mine: {
    title: "Your part in it.",
    deck: "What you’ve accepted, with the preparation to feel ready.",
  },
  "time-off": {
    title: "Room for life.",
    deck: "Keep your team informed while you take time away.",
  },
  tasks: {
    title: "The little things matter.",
    deck: "Shared tasks and meetings, each with a clear next step.",
  },
  "help-line": {
    title: "Every call, returned.",
    deck: "Messages from the help line, and who is calling back.",
    room: "help",
    art: { src: "/assets/living-relief-poster.webp", position: "50% 88%", size: "150% auto" },
  },
  neighbors: {
    title: "Neighbors, by name.",
    deck: "Each household and the help it has received, kept private.",
    room: "help",
    art: { src: "/assets/threshold/courtyard-quiet-plate-v1.webp", position: "78% 62%", size: "auto 150%" },
  },
  treasury: {
    title: "Every gift, cared for.",
    deck: "What came in, what went out, and what it paid for.",
    room: "help",
    art: { src: "/assets/painted-world/meal.webp", position: "88% 70%", size: "auto 190%" },
  },
  reports: {
    title: "The year, added up.",
    deck: "Counts for your council's yearly report, ready to print.",
    room: "help",
    art: { src: "/assets/painted-world/welcome.webp", position: "62% 40%", size: "auto 150%" },
  },
  visits: {
    title: "Two by two.",
    deck: "Home visits, the pair who are going, and what they found.",
    room: "help",
    art: { src: "/assets/painted-world/visit.webp", position: "60% 22%", size: "auto 170%" },
  },
  tools: {
    title: "Bring records in. Take them with you.",
    deck: "From ServWare or a spreadsheet, and back out again whenever you like.",
    room: "help",
  },
};
