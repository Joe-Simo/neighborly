import { v, type Infer } from "convex/values";

/** The eighteen numbers a council receives of one conference's year (convex/councils.ts `figures`). Kept apart so the schema can name them. */
export const councilFigures = v.object({
  households: v.number(),
  people: v.number(),
  adults: v.number(),
  children: v.number(),
  visits: v.number(),
  peopleVisited: v.number(),
  visitHours: v.number(),
  visitMiles: v.number(),
  requestsReceived: v.number(),
  amountRequested: v.number(),
  helpPaid: v.number(),
  callsTaken: v.number(),
  hoursOfService: v.number(),
  activeMembers: v.number(),
  membersServing: v.number(),
  moneyReceived: v.number(),
  moneySpent: v.number(),
  endingBalance: v.number(),
});
export type CouncilFigures = Infer<typeof councilFigures>;
