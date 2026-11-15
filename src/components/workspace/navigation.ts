import {
  CalendarDays,
  Check,
  ClipboardList,
  HeartHandshake,
  Users,
  UserRound,
  Umbrella,
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
export const primaryActions: Record<LiveArea, ActionKind> = {
  week: "announcement",
  team: "team",
  people: "invite",
  commitments: "commitment",
  mine: "announcement",
  "time-off": "timeOff",
  tasks: "task",
};
export const headings: Record<LiveArea, { title: string; deck: string }> = {
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
};
