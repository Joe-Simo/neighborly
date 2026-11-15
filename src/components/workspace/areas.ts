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
