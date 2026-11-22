import { expect, test } from "vitest";
import { TAKE_BACK_DAYS } from "./assistance";
import { seeded } from "./sampleData";

test("the sample always has one voucher given recently enough to be taken back", async () => {
  const now = Date.UTC(2026, 10, 22, 15);
  const rows = (await seeded(now, { name: "Sample Visitor", email: "visitor@example.com" }))("assistanceRequests");
  const takeBack = rows.filter((row) => row.kind === "voucher" && row.status === "paid" && (row.decidedAt ?? 0) >= now - TAKE_BACK_DAYS * 86_400_000);
  expect(takeBack.length).toBeGreaterThan(0);
});
