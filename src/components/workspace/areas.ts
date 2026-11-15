export const liveAreas = [
  "week",
  "team",
  "people",
  "commitments",
  "mine",
  "time-off",
  "tasks",
  "help-line",
  "neighbors",
  "treasury",
  "reports",
  "visits",
  "tools",
] as const;
export type LiveArea = (typeof liveAreas)[number];

/** The room's name as the browser tab shows it. The same words as the menu. */
export const areaTitles: Record<LiveArea, string> = {
  week: "This week",
  team: "Teams",
  people: "People",
  commitments: "Commitments",
  mine: "My commitments",
  "time-off": "Time off",
  tasks: "Tasks & meetings",
  "help-line": "Help line",
  neighbors: "Neighbors",
  treasury: "Treasury",
  reports: "Reports",
  visits: "Home visits",
  tools: "Your files",
};
