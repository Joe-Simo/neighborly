import { afterAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RequestForm, type RequestStart } from "./forms";

const note = "Light bill of $140 due Friday, paid to the power company.";
const whole: RequestStart = { kind: "utility", amountRequested: 14000, payeeKind: "utility", payeeName: "Example Power", summary: note, source: "ai_draft" };
// Nothing is fetched: the form is drawn once, as it stands before the shelf and the payees arrive.
const client = new ConvexReactClient("https://example.convex.cloud");
afterAll(() => client.close());
const form = (start: RequestStart) =>
  renderToStaticMarkup(
    <ConvexProvider client={client}>
      <RequestForm churchId={"c" as Id<"churches">} neighborId={"n" as Id<"neighbors">} start={start} onSaved={() => {}} />
    </ConvexProvider>,
  );

// The backend refuses a request without what they need, a kind, an amount and who is paid.
// Whatever the assistant left blank, the form a person finishes it in has a box for each.
describe("the form a draft is finished in", () => {
  const blanks: [string, RequestStart][] = [
    ["nothing", whole],
    ["the kind", { ...whole, kind: undefined }],
    ["the amount", { ...whole, amountRequested: null }],
    ["who is paid", { ...whole, payeeKind: null, payeeName: "" }],
    ["everything but the note", { summary: note, source: "ai_draft" }],
  ];
  for (const [blank, start] of blanks)
    test(`carries every field the backend needs when the draft left ${blank} blank`, () => {
      const page = form(start);
      for (const name of ["kind", "summary", "amount", "payeeKind", "payeeName"]) expect(page).toContain(`name="${name}"`);
      expect(page).toContain("What they need");
      expect(page).toContain("Light bill of $140 due Friday");
      expect(page).toContain("Save this request");
    });
  test("a request written by hand keeps its own button", () => {
    expect(form({ summary: note })).toContain("Save request");
  });
});
