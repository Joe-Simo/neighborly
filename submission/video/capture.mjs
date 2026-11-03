// Headless capture of the live Neighborly app for the demo video. Throwaway Chrome profile, sample data only.
// Usage: node capture.mjs OUTDIR [live]   ("live" adds Haitian Creole, which costs two free AI calls)
import { chromium } from "/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "https://neighborly-church.vercel.app";
const OUT = process.argv[2];
const LIVE = process.argv[3] === "live";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/f", { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--hide-scrollbars"] });
const VP = { width: 1440, height: 810 };
const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 4 / 3 });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
const T0 = Date.now() / 1000;
const marks = {};
const mark = (k) => { marks[k] = +(Date.now() / 1000 - T0).toFixed(2); console.log(k, marks[k]); };
const frames = [];
const cdp = await ctx.newCDPSession(p);
let running = true;
const loop = (async () => {
  while (running) {
    const t = Date.now() / 1000 - T0;
    try {
      const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
      const fn = `${String(frames.length).padStart(5, "0")}.jpg`;
      fs.writeFileSync(`${OUT}/f/${fn}`, Buffer.from(r.data, "base64"));
      frames.push({ fn, t });
    } catch { await new Promise((r) => setTimeout(r, 50)); }
  }
})();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// A soft ring where the "click" happens, since headless screenshots have no pointer.
const ring = async (loc) => {
  const bb = await loc.boundingBox();
  if (!bb) return;
  await p.evaluate(({ x, y }) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #d97706;background:rgba(217,119,6,.18);z-index:99999;pointer-events:none;transition:opacity .5s`;
    document.body.appendChild(d);
    setTimeout(() => (d.style.opacity = "0"), 650);
    setTimeout(() => d.remove(), 1200);
  }, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
  await wait(450);
};
const click = async (loc) => { await loc.scrollIntoViewIfNeeded(); await ring(loc); await loc.click(); };
const glide = async (loc, offset = 90, ms = 1100) => {
  await loc.waitFor({ timeout: 30000 });
  await loc.evaluate(async (el, { offset, ms }) => {
    const from = scrollY, to = Math.max(0, el.getBoundingClientRect().top + scrollY - offset), t0 = performance.now();
    await new Promise((res) => { const step = (n) => { const k = Math.min(1, (n - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
  }, { offset, ms });
  await wait(250);
};
const type = async (sel, text) => { await click(p.locator(sel)); await p.type(sel, text, { delay: 70 }); };

// 1. Neighborhood
await p.goto(BASE, { waitUntil: "networkidle" });
mark("landing");
await wait(1200);
await p.fill("#zip", "");
await type("#zip", "33919");
await click(p.getByRole("button", { name: "Show languages" }));
await p.waitForSelector("text=Languages spoken at home in", { timeout: 30000 });
mark("chart");
await wait(1500);
await glide(p.locator("#neighbors dl"), 120, 1400);
await wait(3500);
await glide(p.locator("#neighbors fieldset"), 90, 1400);
await wait(4000);
const checked = p.locator("#neighbors input[type=checkbox]:checked");
for (let i = (await checked.count()) - 1; i >= 0; i--) {
  const cb = checked.nth(i);
  const name = await cb.locator("xpath=..").innerText();
  if (!name.startsWith("Spanish") && !(LIVE && name.startsWith("Haitian"))) { await click(cb); await wait(500); }
}
if (LIVE && (await p.locator("#lang-ht").count()) === 0) await p.selectOption("#add-lang", "ht");
mark("picked");
await wait(2500);

// 2. Announcement
await glide(p.locator("#announcement"), 70, 1400);
await click(p.getByRole("button", { name: "Neighbors dinner with a Bible verse" }));
mark("compose");
await wait(3000);
await glide(p.locator('#announcement [aria-label="Facts found"]'), 300, 1000);
mark("facts");
await wait(4500);
const body = await p.inputValue("#body");
await p.fill("#body", body.replace("which reminds us to welcome strangers.", 'which says "Be not forgetful to entertain strangers, for thereby some have entertained angels unawares."'));
await glide(p.locator("#announcement [role=alert]"), 300, 800);
mark("guard");
await wait(5000);
await click(p.getByRole("button", { name: "Neighbors dinner with a Bible verse" }));
await wait(1500);

// 3. Translate
const n = LIVE ? 2 : 1;
const tbtn = p.getByRole("button", { name: n === 2 ? "Translate all 2 languages" : "Translate into Spanish" }).first();
await click(tbtn);
mark("translate");
await glide(p.locator("#review"), 70, 1200);
if (LIVE) {
  await p.locator("#lang-ht").scrollIntoViewIfNeeded();
  await glide(p.locator("#lang-ht").locator("xpath=ancestor::article"), 90, 1000);
  try { await p.waitForSelector("#review [role=status] >> text=s so far", { timeout: 15000 }); mark("progress"); } catch { mark("noprogress"); }
}
await p.waitForSelector("#reviewer-es", { timeout: 200000 });
if (LIVE) await p.waitForSelector("#reviewer-ht", { timeout: 200000 });
mark("done");
await wait(1500);
for (const c of LIVE ? ["es", "ht"] : ["es"]) console.log(c, "origin:", await p.locator(`#lang-${c}`).locator("xpath=ancestor::header").locator(".chip").first().innerText());
const es = p.locator("#lang-es").locator("xpath=ancestor::article");
await glide(es, 70, 1400);
mark("review");
await wait(5000);
const blocks = es.locator("ol > li");
await glide(blocks.nth(1), 90, 1000);
mark("checks");
await wait(4500);
await glide(es.locator("section[aria-label=Scripture]"), 260, 1200);
mark("scripture");
await wait(6000);

// 4. A changed time is caught
await glide(blocks.nth(1), 90, 900);
const b1 = blocks.nth(1);
await click(b1.getByRole("button", { name: "Edit" }));
const ta = b1.locator("textarea");
const orig = await ta.inputValue();
const changed = orig.replace("5:30", "6:30");
await ta.fill(changed.slice(0, changed.indexOf("6:30")));
await p.keyboard.type(changed.slice(changed.indexOf("6:30"), changed.indexOf("6:30") + 4), { delay: 120 });
await ta.fill(changed);
await click(b1.getByRole("button", { name: "Done editing" }));
mark("edited");
await wait(4500);
await click(es.getByRole("button", { name: "Back-translate my edits" }));
await b1.getByText("No back-translation for this wording yet").waitFor({ state: "detached", timeout: 120000 });
console.log("back for edit:", await b1.locator("p.italic").innerText());
await glide(b1, 90, 600);
mark("backflag");
await wait(5500);
// Approval gate: no reviewer name yet.
await click(b1.getByRole("button", { name: "Approve this block" }));
mark("gate1");
await wait(3500);
await glide(es, 70, 900);
await type("#reviewer-es", "Ana Torres");
await wait(800);
await glide(b1, 90, 900);
await click(b1.getByRole("button", { name: "Approve this block" }));
mark("gate2");
await wait(3500);
// The reviewer fixes the time back.
await click(b1.getByRole("button", { name: "Edit" }));
await b1.locator("textarea").fill(orig);
await click(b1.getByRole("button", { name: "Done editing" }));
mark("fixed");
await wait(3500);

// 5. Locked flyer, then approve every block
await p.goto(BASE + "/flyer?lang=es", { waitUntil: "networkidle" });
mark("locked");
await wait(4000);
await p.goto(BASE, { waitUntil: "networkidle" });
await glide(p.locator("#lang-es").locator("xpath=ancestor::article"), 70, 600);
if (LIVE) await p.fill("#reviewer-ht", "Jean Pierre");
mark("approve");
for (let k = 0; k < 20; k++) {
  const btns = p.getByRole("button", { name: "Approve this block" });
  if ((await btns.count()) === 0) break;
  const li = btns.first().locator("xpath=ancestor::li[1]");
  await glide(li, 160, 450);
  const box = li.locator("input[type=checkbox]");
  if (await box.count()) { await click(box); await wait(300); }
  await click(btns.first());
  await wait(700);
}
mark("approved");
await wait(1200);

// 6. Publish and flyer
await glide(p.locator("#publish"), 70, 1400);
mark("publish");
await wait(5000);
await click(p.getByRole("tab", { name: "Printable flyers" }));
await wait(3500);
await p.goto(BASE + "/flyer?lang=es", { waitUntil: "networkidle" });
mark("flyer");
await wait(4500);
await p.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
await wait(4000);
if (LIVE) {
  await p.goto(BASE + "/flyer?lang=ht", { waitUntil: "networkidle" });
  mark("flyerht");
  await wait(5000);
}
mark("stop");

running = false;
await loop;
await b.close();
const span = Date.now() / 1000 - T0;
let s = "ffconcat version 1.0\n";
for (let i = 0; i < frames.length; i++) {
  const start = i === 0 ? 0 : frames[i].t;
  const end = i + 1 < frames.length ? frames[i + 1].t : span;
  s += `file '${frames[i].fn}'\nduration ${Math.max(0.001, end - start).toFixed(4)}\n`;
}
s += `file '${frames.at(-1).fn}'\n`;
fs.writeFileSync(`${OUT}/f/frames.ffconcat`, s);
fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify({ span, frames: frames.length, ...marks }, null, 1));
console.log("frames", frames.length, "fps", (frames.length / span).toFixed(1), "errors", errs.join(" | ") || "none");
