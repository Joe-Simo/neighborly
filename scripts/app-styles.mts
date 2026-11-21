// After `next build`: the stylesheets the workspace's pages are drawn with that the home page does not already have,
// read from the pages Next itself prerendered, written to public/app-styles.json. The home page puts them in place
// before its doors are used (lib/app-styles.ts), so going in no longer adds them, and restyles the page, mid-turn.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = ".next/server/app";
const links = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/<link rel="stylesheet" href="([^"]+)" data-precedence="([^"]+)"/g)].map(([, href, precedence]) => ({ href, precedence }));
const home = new Set(links(join(app, "index.html")).map((link) => link.href));
const pages = [join(app, "app.html"), ...readdirSync(join(app, "app")).filter((file) => file.endsWith(".html")).map((file) => join(app, "app", file))].filter((file) => existsSync(file));
const styles = new Map<string, string>();
for (const page of pages) for (const { href, precedence } of links(page)) if (href && precedence && !home.has(href)) styles.set(href, precedence);
if (!styles.size) throw new Error("No workspace stylesheets found: the way Next writes its prerendered pages has changed.");
writeFileSync("public/app-styles.json", `${JSON.stringify([...styles].map(([href, precedence]) => ({ href, precedence })))}\n`);
console.log(`app-styles: ${styles.size} stylesheets from ${pages.length} pages.`);
