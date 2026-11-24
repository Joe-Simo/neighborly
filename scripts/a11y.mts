// `bun run a11y`: axe (WCAG 2.2 A and AA, and best practice) on the sign-in page and every room of the sample
// conference, at 1440 wide, at 390 wide (a phone), and at 1440 with the page zoomed to 200%. Each room is also
// walked with Tab: every stop must have a name. It runs against a dev server you have started (`bun run dev`, with
// your own .env.local); it reads no keys itself and prints none. It enters the sample through its own door, as a
// visitor does, so it needs no account. Exit code 1 if anything fails.
//
//   A11Y_URL      the site to check (default http://localhost:3000)
//   A11Y_BROWSER  a Chrome or Chromium to use (default: the installed Google Chrome)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright-core";
import { liveAreas } from "../src/components/workspace/areas";

const base = (process.env.A11Y_URL ?? "http://localhost:3000").replace(/\/$/, "");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const sizes = [
  { name: "1440", viewport: { width: 1440, height: 900 }, scale: 1 },
  { name: "390", viewport: { width: 390, height: 844 }, scale: 3 },
  // 200% zoom of a 1440 window: the page is laid out at half the width, each CSS pixel drawn twice.
  { name: "1440 at 200%", viewport: { width: 720, height: 450 }, scale: 2 },
];

type Violation = { id: string; impact: string | null; nodes: { target: string[] }[] };
declare const axe: { run: (scope: Document, options: object) => Promise<{ violations: Violation[] }> };

async function check(page: Page, where: string) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () =>
    (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } })).violations.map(
      (found) => `${found.id} (${found.impact}): ${found.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ")}`,
    ),
  );
  // Every stop of a Tab walk has a name a screen reader can say.
  const unnamed: string[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < 150; step++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return null;
      const box = active.getBoundingClientRect();
      const named = (active.getAttribute("aria-label") ?? "") ||
        (active.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") ||
        ((active as HTMLInputElement).labels?.[0]?.textContent ?? "") || active.textContent || active.getAttribute("title") || "";
      return { key: `${active.tagName}|${Math.round(box.left)},${Math.round(box.top + scrollY)}`, tag: active.tagName.toLowerCase(), named: named.trim() };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    if (!stop.named) unnamed.push(`a ${stop.tag} with no name`);
  }
  const faults = [...violations, ...unnamed];
  console.log(`${faults.length ? "FAIL" : "pass"}  ${where}${faults.length ? "" : `  (${seen.size} Tab stops)`}`);
  for (const fault of faults) console.log(`      ${fault}`);
  return faults.length;
}

/** The room is drawn whole (the shell marks it) and whatever was still arriving is finished. */
async function settled(page: Page) {
  await page.waitForSelector(".live-app[data-room-shown] .live-main:not([data-room-held])", { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getAnimations().forEach((move) => move.finish()));
}

const browser = await chromium.launch(process.env.A11Y_BROWSER ? { executablePath: process.env.A11Y_BROWSER } : { channel: "chrome" });
let failed = 0;
try {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.scale, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${base}/app?intent=signin`);
    await page.waitForSelector("form, [data-slot='button']", { timeout: 30000 });
    failed += await check(page, `${size.name}  sign-in`);
    await page.goto(`${base}/app?intent=sample`);
    await settled(page);
    for (const area of liveAreas) {
      await page.goto(`${base}/app/${area}`);
      await settled(page);
      failed += await check(page, `${size.name}  ${area}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} faults.` : "\nNo faults.");
process.exit(failed ? 1 : 0);
