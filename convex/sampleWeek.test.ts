/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { seeded } from "./sampleData";
import { weekBegan } from "./quilt";

// This week's quilt (convex/quilt.ts) reads what was done since Monday began in New York. The sample must have
// calls returned, visits written up and yeses given in that week on every day, Monday's first minutes included.
const times = [
  "2026-11-23T05:01:00Z", // Monday 00:01 in New York
  "2026-11-23T06:00:00Z", // Monday 01:00
  "2026-11-23T09:00:00Z", // Monday 04:00, when the nightly refresh runs
  "2026-11-23T14:00:00Z", // Monday mid-morning
  "2026-11-25T14:00:00Z", // Wednesday
  "2026-11-30T04:30:00Z", // Sunday 23:30
];

describe("the sample's week", () => {
  for (const iso of times) {
    test(`has its tally at ${iso}`, async () => {
      const now = Date.parse(iso);
      const rows = await seeded(now, { name: "Visitor", email: "visitor@example.org" });
      const monday = weekBegan(now, "America/New_York");
      const inWeek = (at: unknown) => typeof at === "number" && at >= monday && at <= now;
      const calls = rows("calls").filter((call) => call.callback === "done" && inWeek(call.returnedAt));
      const visits = rows("visits").filter((visit) => visit.status === "completed" && inWeek(visit.completedAt));
      const yeses = rows("assistanceRequests").filter((request) => (request.status === "approved" || request.status === "paid") && inWeek(request.decidedAt));
      expect(calls.length).toBeGreaterThanOrEqual(5);
      expect(visits.length).toBeGreaterThanOrEqual(3);
      expect(yeses.length).toBeGreaterThanOrEqual(3);
      // Nothing is done in the future, and a yes never comes before its ask.
      for (const request of yeses) expect(request.decidedAt).toBeGreaterThanOrEqual(request.createdAt);
      expect(rows("calls").every((call) => (call.returnedAt ?? 0) <= now)).toBe(true);
    });
  }
});
