import { describe, expect, test } from "bun:test";
import { urgentSigns } from "./urgency";

describe("signs that a call should be returned first", () => {
  test("a shut-off with its day, and living alone", () => {
    expect(urgentSigns("Power shut-off notice for the 21st. Lives alone.")).toEqual([
      { reason: "shutoff", day: 21 },
      { reason: "elder", day: null },
    ]);
  });

  test("no food and children at home", () => {
    expect(urgentSigns("Asked about food for a family of five. They have no food today and three kids.").map((sign) => sign.reason)).toEqual(["noFood", "child"]);
  });

  test("an ordinary request is not urgent", () => {
    expect(urgentSigns("Behind on November rent. The landlord says four hundred fifty by Friday.")).toEqual([]);
  });

  test("a question, a negation or an if is not a sign", () => {
    expect(urgentSigns("Is there an eviction notice? The power has not been shut off. If she is evicted she will call again.")).toEqual([]);
  });

  test("a day that is not a day of the month is left out", () => {
    expect(urgentSigns("Eviction notice, out by the 45th.")).toEqual([{ reason: "eviction", day: null }]);
  });
});
