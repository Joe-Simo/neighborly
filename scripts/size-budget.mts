// First-load JS gate, read from a production build (`next build`); no browser and no server. Usage: bun run size [--write]
// A page's first load is every script its prerendered HTML names. A room's is its page's, plus the chunks its own
// code is fetched with (sections.ts: `week: () => import(...)`), read from the loader Turbopack writes for that import.
// Each cap is the size measured when it was set plus 2 KB, gzip. --write sets every cap again from this build.
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NEXT = ".next";
const CAPS = "scripts/size-budget.json";
const SLACK = 2048;
const app = join(NEXT, "server/app");
const chunks = join(NEXT, "static/chunks");

const pages: Record<string, string> = {
  "/": "index.html",
  "/about/a-week": "about/a-week.html",
  "/about/how-we-made-it": "about/how-we-made-it.html",
  "/sobre/una-semana": "sobre/una-semana.html",
  "/sobre/como-lo-hicimos": "sobre/como-lo-hicimos.html",
  "/privacy": "privacy.html",
  "/privacidad": "privacidad.html",
  "/offline": "offline.html",
};
// The "Ask for help" pages are for someone on a cheap phone and a bad line, so their cap is set ahead and never moved by --write:
// 100 KB, all of it. React's own runtime alone is over that, so these pages are sent as plain HTML with a form that posts without
// script. Each is checked once its prerendered HTML exists.
const askForHelp: Record<string, string> = { "/help": "help.html", "/ayuda": "ayuda.html" };
const ASK_CAP = 100 * 1024;
const rooms: Record<string, string> = {
  week: "WeekSection", team: "TeamsSection", people: "PeopleSection", commitments: "CommitmentsSection", mine: "MineSection",
  "time-off": "TimeOffSection", tasks: "TasksSection", "help-line": "HelpLineSection", neighbors: "NeighborsSection",
  treasury: "TreasurySection", reports: "ReportsSection", visits: "VisitsSection", tools: "ToolsSection",
};

const named = (text: string) => new Set([...text.matchAll(/static\/chunks\/([\w.-]+\.js)/g)].map((match) => match[1]).filter((file) => file !== undefined));
const bytes = new Map<string, number>();
const gz = (file: string) => {
  const known = bytes.get(file);
  if (known !== undefined) return known;
  const size = gzipSync(readFileSync(join(chunks, file))).length;
  bytes.set(file, size);
  return size;
};
const sum = (files: Set<string>) => [...files].reduce((total, file) => total + gz(file), 0);

const code = readdirSync(chunks).filter((file) => file.endsWith(".js")).map((file) => readFileSync(join(chunks, file), "utf8"));
/** The chunks a room's import loads: `week:()=>e.A(5796).then(e=>e.WeekSection)` names the loader 5796, whose module lists them. */
function roomChunks(section: string) {
  const id = code.map((text) => text.match(new RegExp(`\\.A\\((\\d+)\\)\\.then\\(\\w+=>\\w+\\.${section}\\)`))?.[1]).find(Boolean);
  if (!id) throw new Error(`No loader found for ${section}: the way sections.ts fetches rooms has changed.`);
  const loader = code.map((text) => text.match(new RegExp(`[,\\[]${id},\\w+=>\\{\\w+\\.v\\(.*?Promise\\.all\\(\\[([^\\]]*)\\]`))?.[1]).find(Boolean);
  if (!loader) throw new Error(`No chunk list found for ${section}'s loader ${id}.`);
  return named(loader);
}

const measured: Record<string, number> = {};
for (const [route, file] of Object.entries(pages)) measured[route] = sum(named(readFileSync(join(app, file), "utf8")));
for (const [room, section] of Object.entries(rooms)) {
  const files = named(readFileSync(join(app, "app", `${room}.html`), "utf8"));
  for (const chunk of roomChunks(section)) files.add(chunk);
  measured[`/app/${room}`] = sum(files);
}

const fixed: Record<string, number> = {};
for (const [route, file] of Object.entries(askForHelp)) {
  if (existsSync(join(app, file))) fixed[route] = sum(named(readFileSync(join(app, file), "utf8")));
  else console.log(`wait ${route.padEnd(24)} not built yet; its cap is ${ASK_CAP / 1024} KB`);
}

const kb = (size: number) => `${(size / 1024).toFixed(1)} KB`;
if (process.argv.includes("--write") || !existsSync(CAPS)) {
  writeFileSync(CAPS, `${JSON.stringify(Object.fromEntries(Object.entries(measured).map(([route, size]) => [route, size + SLACK])), null, 2)}\n`);
  console.log(`Caps written to ${CAPS}: each measured size plus ${SLACK / 1024} KB.`);
}
const caps: Record<string, number> = JSON.parse(readFileSync(CAPS, "utf8"));
let over = 0;
for (const [route, size] of Object.entries(measured)) {
  const cap = caps[route];
  const fails = cap === undefined || size > cap;
  if (fails) over++;
  console.log(`${fails ? "over" : "ok  "} ${route.padEnd(24)} ${kb(size).padStart(9)} of ${cap === undefined ? "no cap" : kb(cap)}`);
}
for (const [route, size] of Object.entries(fixed)) {
  const fails = size > ASK_CAP;
  if (fails) over++;
  console.log(`${fails ? "over" : "ok  "} ${route.padEnd(24)} ${kb(size).padStart(9)} of ${kb(ASK_CAP)} (fixed)`);
}
if (over) {
  console.error(`${over} over budget. Make it smaller, or raise its cap with the reason in the landing note.`);
  process.exit(1);
}
