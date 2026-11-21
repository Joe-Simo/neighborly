// After `next build`: the stylesheets the workspace's pages are drawn with that the home page does not already have, read from
// the client reference manifests Next writes for every page (local and Vercel builds alike), written to public/app-styles.json.
// The home page puts them in place before its doors are used (lib/app-styles.ts), so going in no longer adds them mid-turn.
// Should the manifests change shape, the list is left empty with a loud warning: the doors then work as they did before.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

type Css = { path: string; inlined?: boolean };
type Manifest = { entryCSSFiles?: Record<string, Css[]> };
const app = ".next/server/app";
const OUT = "public/app-styles.json";

/** A page's manifest is a script that sets `globalThis.__RSC_MANIFEST[page]`; it is run in a bare context to read it. */
function manifest(page: string): Record<string, Css[]> {
  const file = join(app, page, "page_client-reference-manifest.js");
  if (!existsSync(file)) return {};
  const scope: { __RSC_MANIFEST?: Record<string, Manifest> } = {};
  runInNewContext(readFileSync(file, "utf8"), { globalThis: scope, self: scope });
  return Object.values(scope.__RSC_MANIFEST ?? {})[0]?.entryCSSFiles ?? {};
}
const files = (entries: Record<string, Css[]>, keep: (entry: string) => boolean) =>
  Object.entries(entries).filter(([entry]) => keep(entry)).flatMap(([, css]) => css.filter((each) => !each.inlined).map((each) => each.path));

let styles: string[] = [];
try {
  // Everything the home page's own manifest names (its layout, page and boundaries) is already in its head.
  const home = new Set(files(manifest(""), () => true));
  const workspace = new Set([...files(manifest("app"), (entry) => entry.startsWith("[project]/src/app/")), ...files(manifest("app/[area]"), (entry) => entry.startsWith("[project]/src/app/"))]
    .filter((path) => !home.has(path)));
  styles = [...workspace];
} catch (error) {
  console.warn(`\n⚠️  app-styles: could not read Next's manifests (${String(error)}).`);
}
if (!styles.length) console.warn("\n⚠️  app-styles: no workspace stylesheets found. public/app-styles.json is empty; the doors add them on the way in, as before.\n");
writeFileSync(OUT, `${JSON.stringify(styles.map((path) => ({ href: `/_next/${path}`, precedence: "next" })))}\n`);
console.log(`app-styles: ${styles.length} stylesheets.`);
