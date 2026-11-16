/**
 * The sample conference's last whole year (October 2025 to September 2026), as its Reports room adds it up
 * when the sample is built at `asOf`. The home page shows these and asks the backend nothing.
 * They are never typed from memory: convex/sampleYear.test.ts builds the sample at that moment and fails
 * if any figure here differs from the yearly report, so a change to the seed says so at once.
 * The live sample is rebuilt every night from the day it is built on, and its totals move a little with it.
 */
export const sampleYear = {
  asOf: "2026-11-15T15:00:00Z",
  year: 2026,
  calls: 439,
  requests: 354,
  visits: 320,
  /** Cents paid toward requests: to a landlord, a utility or a store, never in cash. */
  helpPaid: 5172500,
} as const;

/** Said once by "Your turn." when the visitor's yes is given, so the year's count of requests goes up by one. On the page only. */
export const YES_GIVEN = "kindhelps:yes";
