// `bun run words-whole [base, default http://localhost:3196]`: no head or name ever breaks inside a word, runs off the window, or makes a page scroll sideways.
// Public pages (both languages) at 360, 768, 1440 and 1920; the 13 rooms through the mac-rig (/tools-sketch) in both languages at 390 and 1440;
// and the rooms' names on a 390 phone at the largest text: the web's 130% and the iOS app's 200%, as Safari draws them (text-size-adjust, which a mobile Chromium follows too).
// WORDS_BROWSER: a Chromium binary (else installed Chrome). Exit 1 on any fault.
import { chromium, type Browser } from "playwright-core";
import { liveAreas } from "../src/components/workspace/areas";

const base = (process.argv[2] ?? "http://localhost:3196").replace(/\/$/, "");
const publicRoutes = ["/", "/about/how-we-made-it", "/sobre/como-lo-hicimos", "/about/a-week", "/sobre/una-semana", "/privacy", "/privacidad", "/offline", "/no-such-page", "/app?intent=signin"];
const heads = "h1, h2, h3, [class*=title]";
// The rooms' names, as paper.css keeps them whole.
const names = ".live-name, .visits-name, .help-row h3 > .help-row-open, .help-sheet .help-from strong, .visits-written-who strong, .volunteer-who, .live-name-word";

/** Every word of the matched elements on one line and inside the window, and nothing wider than the window. */
const faultsIn = (selector: string) => {
  const faults: string[] = [];
  const where = (element: Element) => `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 40)}"`;
  if (document.documentElement.scrollWidth > innerWidth + 1) faults.push(`the page scrolls sideways (${document.documentElement.scrollWidth} in ${innerWidth})`);
  for (const element of document.querySelectorAll(selector)) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || !element.getClientRects().length) continue;
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = text.nextNode(); node; node = text.nextNode()) {
      for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
        if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1) faults.push(`"${word[0]}" breaks inside itself in ${where(element)}`);
        if (rects.some((rect) => rect.right > innerWidth + 1 || rect.left < -1)) faults.push(`"${word[0]}" runs off the window in ${where(element)}`);
      }
    }
  }
  return [...new Set(faults)];
};

const browserPath = process.env.WORDS_BROWSER;
const browser: Browser = await chromium.launch(browserPath ? { executablePath: browserPath } : { channel: "chrome" });
let failed = 0;

async function check(url: string, width: number, selector: string, label: string, large?: "web" | "app") {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", ...(large && { deviceScaleFactor: 3, isMobile: true, hasTouch: true }) });
  const page = await context.newPage();
  // What system-text-size.ts sets on an iPhone at that size.
  if (large) await page.addInitScript((app) => {
    const root = document.documentElement;
    root.setAttribute("data-text-large", "");
    if (app) { root.setAttribute("data-text-ax", ""); root.dataset.shell = "ios"; }
    document.addEventListener("DOMContentLoaded", () => root.style.setProperty("-webkit-text-size-adjust", app ? "200%" : "130%"));
  }, large === "app");
  await page.goto(base + url, { waitUntil: "networkidle", timeout: 60000 });
  if (url.startsWith("/tools-sketch")) await page.waitForSelector(".live-app[data-room-shown]", { timeout: 30000 });
  await page.waitForTimeout(400);
  const faults = await page.evaluate(faultsIn, selector);
  await context.close();
  if (!faults.length) return;
  failed += faults.length;
  console.log(`FAIL  ${label}`);
  for (const fault of faults) console.log(`      ${fault}`);
}

try {
  for (const width of [360, 768, 1440, 1920]) for (const route of publicRoutes) await check(route, width, heads, `${width}  ${route}`);
  for (const lang of ["en", "es"]) for (const area of liveAreas) {
    const room = `/tools-sketch?area=${area}&lang=${lang}`;
    for (const width of [390, 1440]) await check(room, width, `${heads}, ${names}`, `${width}  ${lang}  ${area}`);
    await check(room, 390, names, `390 at 130%  ${lang}  ${area}  names`, "web");
    await check(room, 390, names, `390 at 200% (app)  ${lang}  ${area}  names`, "app");
  }
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} faults.` : "\nEvery head and name whole.");
process.exit(failed ? 1 : 0);
