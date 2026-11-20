import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A room's tally sits on the app's type scale: its words at the 13px meta step, its main figure at the 35px figure step.
const css = (file: string) => readFileSync(join(import.meta.dir, file), "utf8");
const fontSize = (sheet: string, selector: string) => {
  const rule = sheet.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m"));
  if (!rule) throw new Error(`no rule for ${selector}`);
  return rule[1].match(/font-size:\s*([^;]+);/)?.[1].trim();
};

test.each([
  ["paper.css", ".room-tally"],
  ["help.css", ".neighbors-tally"],
])("%s %s: words 13px, figure 35px", (file, tally) => {
  const sheet = css(file);
  expect(fontSize(sheet, `${tally} dt`)).toBe("13px");
  expect(fontSize(sheet, `${tally} b`)).toBe("35px");
});
