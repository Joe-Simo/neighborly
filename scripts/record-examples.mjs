// Records real AI output for the sample announcements, so the demo still works when the free tier is used up.
// Usage: start the app with OPENROUTER_API_KEY set, then: node scripts/record-examples.mjs http://localhost:3000
// Each entry keeps the model name and date and is shown in the app as a "Recorded example", never as live output.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { SAMPLES, toBlocks } from "../src/lib/samples.ts";
import { STARTER_GLOSSARY } from "../src/lib/glossary.ts";

const base = process.argv[2] ?? "http://localhost:3000";
const plan = { sunday: ["es", "zh-Hans", "ht", "vi"], meal: ["es", "zh-Hans"], groups: ["es", "ru"], welcome: ["es", "ht"] };
const file = new URL("../src/data/recorded.json", import.meta.url);
const recorded = JSON.parse(readFileSync(file, "utf8"));
const key = (lang, blocks) => createHash("sha256").update(JSON.stringify({ lang, blocks })).digest("hex");

for (const [id, langs] of Object.entries(plan)) {
  const s = SAMPLES.find((x) => x.id === id);
  const blocks = toBlocks(s.title, s.body);
  for (const lang of langs) {
    const k = key(lang, blocks);
    if (recorded.some((r) => r.key === k)) continue;
    const res = await fetch(`${base}/api/translate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, blocks, glossary: STARTER_GLOSSARY }) });
    // The route streams newline-delimited JSON progress; the last line holds the result or the error.
    const last = JSON.parse((await res.text()).trim().split("\n").at(-1));
    const body = last.result ?? last;
    if (!res.ok || body.origin !== "live") {
      console.log(`${id} ${lang}: skipped (${res.status} ${body.error ?? body.origin})`);
      continue;
    }
    recorded.push({ key: k, sample: id, lang, model: body.model, generatedAt: body.generatedAt, blocks: body.blocks });
    writeFileSync(file, JSON.stringify(recorded, null, 1) + "\n");
    console.log(`${id} ${lang}: recorded from ${body.model}`);
  }
}
