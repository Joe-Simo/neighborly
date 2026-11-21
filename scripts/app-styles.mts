// After `next build`: the stylesheets the workspace's pages are drawn with that the home page does not already have, read from
// the client reference manifests Next writes for every page (local and Vercel builds alike), written to public/app-styles.json.
// The home page puts them in place before its doors are used (lib/app-styles.ts), so going in no longer adds them mid-turn.
// Should the manifests change shape, the list is left empty with a loud warning: the doors then work as they did before.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

type Css = { path: string; inlined?: boolean };
type Manifest = { entryCSSFiles?: Record<string, Css[]>; entryJSFiles?: Record<string, string[]> };
const app = ".next/server/app";
const OUT = "public/app-styles.json";

/** A page's manifest is a script that sets `globalThis.__RSC_MANIFEST[page]`; it is run in a bare context to read it. */
function manifest(page: string): Manifest {
  const file = join(app, page, "page_client-reference-manifest.js");
  if (!existsSync(file)) return {};
  const scope: { __RSC_MANIFEST?: Record<string, Manifest> } = {};
  runInNewContext(readFileSync(file, "utf8"), { globalThis: scope, self: scope });
  return Object.values(scope.__RSC_MANIFEST ?? {})[0] ?? {};
}
const files = (entries: Record<string, Css[]>, keep: (entry: string) => boolean) =>
  Object.entries(entries).filter(([entry]) => keep(entry)).flatMap(([, css]) => css.filter((each) => !each.inlined).map((each) => each.path));

// The workspace's segments also draw a `<script async>` for each of their chunks (Next renders them with the segment). Each is
// one React has never seen on the home page, so it was made and put in the head inside the door's commit, 1.5ms apiece.
const scriptFiles = (entries: Record<string, string[]>) =>
  Object.entries(entries).filter(([entry]) => entry.startsWith("[project]/src/app/")).flatMap(([, js]) => js);

let styles: string[] = [];
let scripts: string[] = [];
try {
  // Everything the home page's own manifest names (its layout, page and boundaries) is already in its head.
  const home = manifest(""), root = manifest("app"), area = manifest("app/[area]");
  const homeCss = new Set(files(home.entryCSSFiles ?? {}, () => true));
  const workspace = new Set([...files(root.entryCSSFiles ?? {}, (entry) => entry.startsWith("[project]/src/app/")), ...files(area.entryCSSFiles ?? {}, (entry) => entry.startsWith("[project]/src/app/"))]
    .filter((path) => !homeCss.has(path)));
  styles = [...workspace];
  const homeJs = new Set(Object.values(home.entryJSFiles ?? {}).flat());
  scripts = [...new Set([...scriptFiles(root.entryJSFiles ?? {}), ...scriptFiles(area.entryJSFiles ?? {})])].filter((path) => !homeJs.has(path));
} catch (error) {
  console.warn(`\n⚠️  app-styles: could not read Next's manifests (${String(error)}).`);
}
if (!styles.length) console.warn("\n⚠️  app-styles: no workspace stylesheets found. public/app-styles.json is empty; the doors add them on the way in, as before.\n");
writeFileSync(OUT, `${JSON.stringify([...styles.map((path) => ({ href: `/_next/${path}`, precedence: "next" })), ...scripts.map((path) => ({ href: `/_next/${path}`, as: "script" }))])}\n`);
console.log(`app-styles: ${styles.length} stylesheets, ${scripts.length} scripts.`);
