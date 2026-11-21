import { describe, expect, test } from "bun:test";
import type { HelpRequest } from "./format";
import { referralsOf, requestDetailFacts } from "./request-detail-facts";
import { requestDetailWords } from "./request-detail-words";

// Made-up requests from one made-up neighbor; only the fields the page reads matter.
const row = (id: string, createdAt: number, extra: Partial<HelpRequest> = {}) =>
  ({ id, createdAt, kind: "rent", amountRequested: 10000, amountApproved: null, status: "open", referral: "", referrals: [], ...extra }) as HelpRequest;

describe("the printed request", () => {
  const rows = [
    row("later", 400),
    row("this", 300, { amountRequested: 45000 }),
    row("paid", 200, { amountRequested: 20000, amountApproved: 15000, status: "paid" }),
    row("declined", 100, { amountRequested: 30000, amountApproved: 0, status: "declined" }),
  ];

  test("lists only the help asked for before it, newest first, with its totals", () => {
    const { request, past, totals } = requestDetailFacts(rows, "this" as HelpRequest["id"]);
    expect(request?.amountRequested).toBe(45000);
    expect(past.map((one) => String(one.id))).toEqual(["paid", "declined"]);
    expect(totals).toEqual({ count: 2, asked: 50000, approved: 15000 });
  });

  test("a request not among the rows is not drawn", () => {
    expect(requestDetailFacts(rows, "gone" as HelpRequest["id"]).request).toBeNull();
  });

  test("names each referral once", () => {
    expect(referralsOf({ referrals: ["Food Pantry", "Legal Aid "], referral: "Food Pantry" })).toEqual(["Food Pantry", "Legal Aid"]);
  });

  test("every word is there in English and Spanish", () => {
    const english = requestDetailWords("en");
    const spanish = requestDetailWords("es");
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
    expect(spanish.print).not.toBe(english.print);
    expect(spanish.totalsLine(3)).toContain("3");
  });
});
