// After `next build`: the offline worker is bundled here, once, and written to public/serwist/sw.js, so it is served as a
// plain file. It used to be built by a route handler (`@serwist/turbopack`), which on Vercel fell through to its function
// and failed there (it reads Next's own config module, which is not traced into the function): /serwist/sw.js answered 500.
import { mkdirSync, writeFileSync } from "node:fs";
import { getManifest } from "@serwist/build";
import { build } from "esbuild";

const OUT = "public/serwist";
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

const { manifestEntries = [], count, size } = await getManifest({
  globDirectory: ".",
  // Only what the offline page needs. The painted artwork and every signed-in page stay on the network,
  // so nothing private is kept on a shared phone or tablet.
  globPatterns: [".next/static/**/*.{js,css}", "public/fonts/*.woff2", "public/assets/living-relief-poster.webp", "public/assets/living-relief-poster-gl.webp"],
  globIgnores: [`${OUT}/**`],
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.map((entry) => ({
        ...entry,
        url: entry.url.startsWith(".next/") ? `/_next/${entry.url.slice(6)}` : entry.url.startsWith("public/") ? `/${entry.url.slice(7)}` : entry.url,
      })),
      warnings: [],
    }),
  ],
});

const result = await build({
  entryPoints: { sw: "src/app/sw.ts" },
  outdir: OUT,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome111", "safari16.4", "firefox111"],
  minify: true,
  sourcemap: true,
  treeShaking: true,
  define: { "self.__SW_MANIFEST": JSON.stringify(manifestEntries) },
  write: false,
});
mkdirSync(OUT, { recursive: true });
for (const file of result.outputFiles) writeFileSync(file.path, file.text);
console.log(`service worker: ${count} precache entries (${(size / 1024).toFixed(1)} KiB) -> ${OUT}/sw.js`);
