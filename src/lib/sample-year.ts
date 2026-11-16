/**
 * The sample conference's last whole year (October 2025 to September 2026), as its Reports room adds it up
 * The home page shows these and asks the backend nothing. The seed holds that closed year still, whatever
 * day the sample is rebuilt on, so the page and the sample's Reports room read the same to the digit.
 * They are never typed from memory: convex/sampleYear.test.ts builds the sample on two different days and fails
 * if any figure here differs from the yearly report, so a change to the seed says so at once.
 */
export const sampleYear = {
  year: 2026,
  calls: 459,
  requests: 370,
  visits: 325,
  /** Cents paid toward requests: to a landlord, a utility or a store, never in cash. */
  helpPaid: 5243500,
} as const;

/** Said once by "Your turn." when the visitor's yes is given, so the year's count of requests goes up by one. On the page only. */
export const YES_GIVEN = "kindhelps:yes";
