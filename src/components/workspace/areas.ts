export const liveAreas = [
  "week",
  "team",
  "people",
  "commitments",
  "mine",
  "time-off",
  "tasks",
] as const;
export type LiveArea = (typeof liveAreas)[number];
