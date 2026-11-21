// Loads the Census ZCTA centre points and land areas (public domain) into the zipCentroids table, 500 rows a call. Run once per deployment.
// Usage: bun scripts/zip-centroids.mts [path/to/YYYY_Gaz_zcta_national.txt|.zip] [--prod]
// With no path it downloads the latest Gazetteer from www2.census.gov. About 33,800 rows, under 3 MB in the database.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

const BASE = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/";
const args = process.argv.slice(2);
const prod = args.includes("--prod");
const path = args.find((arg) => !arg.startsWith("--"));

async function latest(): Promise<Uint8Array> {
  for (let year = new Date().getFullYear(); year >= 2020; year--) {
    const answer = await fetch(`${BASE}${year}_Gazetteer/${year}_Gaz_zcta_national.zip`);
    if (answer.ok) {
      console.log(`Using the ${year} Gazetteer.`);
      return new Uint8Array(await answer.arrayBuffer());
    }
  }
  throw new Error("No Gazetteer found. Download *_Gaz_zcta_national.zip by hand and pass its path.");
}
function text(bytes: Uint8Array, name: string) {
  if (!name.endsWith(".zip")) return strFromU8(bytes);
  const files = unzipSync(bytes);
  const inner = Object.keys(files).find((file) => file.endsWith(".txt"));
  if (!inner) throw new Error("The zip has no .txt inside.");
  return strFromU8(files[inner]);
}

const bytes = path ? (existsSync(path) ? new Uint8Array(readFileSync(path)) : (() => { throw new Error(`${path} not found`); })()) : await latest();
const [header, ...lines] = text(bytes, path ?? "x.zip").trim().split(/\r?\n/);
const sep = header.includes("|") ? "|" : "\t";
const columns = header.split(sep).map((column) => column.trim());
const at = (name: string) => {
  const index = columns.indexOf(name);
  if (index < 0) throw new Error(`No ${name} column in the Gazetteer header.`);
  return index;
};
const [zip, lat, lng, land] = [at("GEOID"), at("INTPTLAT"), at("INTPTLONG"), at("ALAND_SQMI")];
const rows = lines.map((line) => line.split(sep)).map((cells) => ({ zip: cells[zip].trim(), lat: Number(cells[lat]), lng: Number(cells[lng]), sqmi: Number(cells[land]) }))
  .filter((row) => /^\d{5}$/.test(row.zip) && Number.isFinite(row.lat) && Number.isFinite(row.lng));
console.log(`${rows.length} zip codes read.`);
for (let start = 0; start < rows.length; start += 500) {
  const batch = JSON.stringify({ rows: rows.slice(start, start + 500).map((row) => ({ zip: row.zip, lat: Number(row.lat.toFixed(6)), lng: Number(row.lng.toFixed(6)), ...(Number.isFinite(row.sqmi) && row.sqmi > 0 ? { sqmi: Number(row.sqmi.toFixed(2)) } : {}) })) });
  const run = spawnSync("bunx", ["convex", "run", ...(prod ? ["--prod"] : []), "intake:seedZips", batch], { stdio: ["ignore", "ignore", "inherit"] });
  if (run.status !== 0) throw new Error(`Stopped at row ${start}; running it again picks up safely (rows already kept are moved, not doubled).`);
  process.stdout.write(`\r${Math.min(start + 500, rows.length)} of ${rows.length}`);
}
console.log("\nDone.");
