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
] as const;
export type LiveArea = (typeof liveAreas)[number];
