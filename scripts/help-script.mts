// Builds the one script of the Ask for help pages (src/lib/help-page/botid-client.ts) into public/help-botid.js.
const built = await Bun.build({ entrypoints: ["src/lib/help-page/botid-client.ts"], minify: true, target: "browser", format: "iife", define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV === "development" ? "development" : "production") } });
if (!built.success) {
  for (const message of built.logs) console.error(message);
  process.exit(1);
}
const code = await built.outputs[0].text();
await Bun.write("public/help-botid.js", code);
console.log(`public/help-botid.js ${(code.length / 1024).toFixed(1)} KB`);
