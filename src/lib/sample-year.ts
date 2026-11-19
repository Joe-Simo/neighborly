/**
 * The sample conference's last whole year (October 2025 to September 2026), as its Reports room adds it up
 * when the sample is built at `asOf`. The home page shows these and asks the backend nothing.
 * They are never typed from memory: convex/sampleYear.test.ts builds the sample at that moment and fails
 * if any figure here differs from the yearly report, so a change to the seed says so at once.
 * The closed year is pinned in the seed, so the live sample's nightly rebuild leaves these figures as they are.
 */
export const sampleYear = {
  asOf: "2026-11-15T15:00:00Z",
  year: 2026,
  calls: 459,
  requests: 370,
  visits: 325,
  /** Cents paid toward requests: to a landlord, a utility or a store, never in cash. */
  helpPaid: 5243500,
  /** Cents the conference said yes to on the week page's Thursday: the sample's electric bill with a shut-off notice. */
  weekHelp: 21000,
} as const;

/** Said once by "Your turn." when the visitor's yes is given, so the year's count of requests goes up by one. On the page only. */
export const YES_GIVEN = "kindhelps:yes";
