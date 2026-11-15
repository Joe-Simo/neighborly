import { describe, expect, test } from "bun:test";
import { urgentSigns } from "./urgency";

describe("signs that a call should be returned first", () => {
  test("a shut-off with its day, and living alone", () => {
    expect(urgentSigns("Power shut-off notice for the 21st. Lives alone.")).toEqual([
      { reason: "shutoff", day: 21 },
      { reason: "alone", day: null },
    ]);
  });

  test("each sign says one thing: alone is not elderly, hungry is not out of food", () => {
    const reasons = (note: string) => urgentSigns(note).map((sign) => sign.reason);
    expect(reasons("She lives alone.")).toEqual(["alone"]);
    expect(reasons("He is elderly, 84 years old.")).toEqual(["elder"]);
    expect(reasons("The kids are hungry.")).toEqual(["hungry", "child"]);
    expect(reasons("She hasn't eaten since Sunday.")).toEqual(["hungry"]);
    expect(reasons("There is no food in the house.")).toEqual(["noFood"]);
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
