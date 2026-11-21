import type { HelpRequest } from "@/components/workspace/help-line/format";

/** The request on the page, the help asked for before it (newest first), and what that earlier help came to. */
export function requestDetailFacts(rows: HelpRequest[], requestId: HelpRequest["id"]) {
  const request = rows.find((row) => row.id === requestId) ?? null;
  const past = rows
    .filter((row) => row.id !== requestId && (!request || row.createdAt <= request.createdAt))
    .sort((a, b) => b.createdAt - a.createdAt);
  const totals = past.reduce(
    (sum, row) => ({
      count: sum.count + 1,
      asked: sum.asked + row.amountRequested,
      approved: sum.approved + (row.status === "declined" ? 0 : (row.amountApproved ?? 0)),
    }),
    { count: 0, asked: 0, approved: 0 },
  );
  return { request, past, totals };
}

/** Every place the neighbor was pointed to, once each, in the order they were named. */
export const referralsOf = (request: Pick<HelpRequest, "referrals" | "referral">) =>
  [...new Set([...request.referrals, request.referral].map((name) => name.trim()).filter(Boolean))];
