import { describe, expect, test } from "bun:test";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelpDone } from "./help-line/room";
import { Outcome } from "./shell";
import { ToolsDone } from "./tools/sheet-import";
import { Said } from "./volunteer/commitment-rows";

// One done moment in every room: the same green line, the same circled tick, the words that name what was done.
function looksDone(page: string, words: string) {
  expect(page).toContain("live-success help-done");
  expect(page).toContain("lucide-circle-check");
  expect(page.replace(/<[^>]+>/g, "").replace(/\u00a0| /g, " ")).toContain(words);
  expect(page).not.toContain('role="status"');
}

describe("the done line", () => {
  test("the workspace's saved line", () => looksDone(renderToStaticMarkup(<Outcome ref={createRef()}>Joined Pantry.</Outcome>), "Joined Pantry."));
  test("a room's own line", () => looksDone(renderToStaticMarkup(<HelpDone>Payment recorded.</HelpDone>), "Payment recorded."));
  test("a reply taken", () => looksDone(renderToStaticMarkup(<Said of="a">Accepted Pantry morning.</Said>), "Accepted Pantry morning."));
  test("a tool finished", () => looksDone(renderToStaticMarkup(<ToolsDone>Added 4 neighbors.</ToolsDone>), "Added 4 neighbors."));
});
