// Writes the Lighthouse numbers the how-we-made-it page publishes, from Lighthouse's own JSON reports and nothing else.
// Usage, at the freeze: bun scripts/lighthouse-freeze.mts <commit> <report.json> [<report.json> ...]
// Each report is one run of `lighthouse <url> --output=json` (the mobile default, or --preset=desktop). Every run given is kept as it came.
import { readFileSync, writeFileSync } from "node:fs";

type Report = {
  fetchTime: string; lighthouseVersion: string; finalDisplayedUrl: string;
  configSettings: { formFactor: "mobile" | "desktop" };
  categories: Record<"performance" | "accessibility" | "best-practices" | "seo", { score: number }>;
  audits: Record<"largest-contentful-paint", { numericValue: number }>;
};

const [commit, ...files] = process.argv.slice(2);
if (!commit || files.length === 0) throw new Error("Usage: bun scripts/lighthouse-freeze.mts <commit> <report.json>...");
const runs = files.map((file) => {
  const { fetchTime, lighthouseVersion, finalDisplayedUrl, configSettings, categories, audits } = JSON.parse(readFileSync(file, "utf8")) as Report;
  // A run limited to some categories (--only-categories) is not a whole run, and the page prints all four.
  if (!categories.performance || !categories.accessibility || !categories["best-practices"] || !categories.seo) throw new Error(`${file}: run Lighthouse with all four categories`);
  return {
    form: configSettings.formFactor, url: finalDisplayedUrl, at: fetchTime, version: lighthouseVersion,
    // Lighthouse's own score is 0 to 1; the 0 to 100 it shows is that times 100, and that is what is kept.
    scores: [categories.performance, categories.accessibility, categories["best-practices"], categories.seo].map(({ score }) => Math.round(score * 100)),
    lcpMs: Math.round(audits["largest-contentful-paint"].numericValue),
  };
});
writeFileSync("eval/lighthouse/freeze.json", `${JSON.stringify({ commit, runs }, null, 2)}\n`);
