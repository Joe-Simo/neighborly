import { expect, test } from "bun:test";
import { upcomingCommitments, withoutIncomingRequests } from "./commitment-visibility";

test("active schedules omit cancelled dates while the all-commitments list retains them", () => {
  const dates = [
    { id: "cancelled", start: 150, end: 250, status: "cancelled" },
    { id: "accepted", start: 170, end: 270, status: "accepted" },
    { id: "open", start: 120, end: 220, status: "open" },
    { id: "past", start: 20, end: 90, status: "accepted" },
  ];
  expect(upcomingCommitments(dates, 100).map((item) => item.id)).toEqual(["open", "accepted"]);
  expect(upcomingCommitments(dates, 100, true).map((item) => item.id)).toEqual(["open", "cancelled", "accepted"]);
  expect(dates[0].id).toBe("cancelled");
});

test("week list omits only commitments already represented by incoming requests", () => {
  const commitments = [{ id: "invited" }, { id: "accepted" }, { id: "open" }];
  expect(withoutIncomingRequests(commitments, [{ commitmentId: "invited" }])).toEqual([{ id: "accepted" }, { id: "open" }]);
  expect(withoutIncomingRequests(commitments, [])).toEqual(commitments);
});
