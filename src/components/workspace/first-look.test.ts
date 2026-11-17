import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * In the sample's first look a press that opens something is kept and made once the signed-in room is in; a press
 * that writes never is (first-look.tsx). Every control This week draws is named here as one or the other, so a
 * new control cannot be kept by accident: it fails this test until someone says which it is.
 */
const week = ["volunteer/week.tsx", "volunteer/commitment-rows.tsx", "week-note/week-note.tsx", "week-note/assistant-limits.tsx"];
/** What a press on each control does, by its handler. */
const opens = ["showCommitment(item, event.currentTarget)", "setOpen(true)", "setOpen(!open)", "setPrinting(true)"];
const writes = [
  // A yes or a no to a request to cover.
  "void respond(request, true, event.currentTarget)",
  "void respond(request, false, event.currentTarget)",
  // "Done reading" puts the week's note away on this device.
  "putAway",
];

describe("This week's controls in a first look", () => {
  const controls = week.flatMap((file) => {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    // Each opening tag that carries a press handler, with everything written on it.
    return [...source.matchAll(/<(?:Button|button)\b[^>]*?onClick=\{(?:\(\w*\) => )?([^}]+)\}[^>]*?>/g)].map((tag) => ({ file, does: tag[1].trim(), kept: tag[0].includes('data-opens=""') }));
  });

  test("every control is named as one that opens or one that writes", () => {
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect([...opens, ...writes], `${control.file}: ${control.does}`).toContain(control.does);
  });

  test("a control that writes is never kept", () => {
    const written = controls.filter((control) => writes.includes(control.does));
    expect(written.map((control) => control.does).sort()).toEqual([...writes].sort());
    for (const control of written) expect(control.kept, `${control.file}: ${control.does}`).toBe(false);
  });

  test("a control that opens is kept", () => {
    for (const control of controls.filter((one) => opens.includes(one.does))) expect(control.kept, `${control.file}: ${control.does}`).toBe(true);
  });
});
