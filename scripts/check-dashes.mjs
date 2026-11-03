// Fails if any tracked text file contains an en dash or em dash. Run before every commit.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const banned = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
let bad = 0;
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|ico|webp|woff2?)$/i.test(f)) continue;
  let text;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (banned.some((d) => line.includes(d))) {
      console.error(`${f}:${i + 1}: dash character found`);
      bad++;
    }
  });
}
if (bad) process.exit(1);
console.log(`No en or em dashes in ${files.length} files.`);
