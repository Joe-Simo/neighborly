import { describe, expect, test } from "bun:test";
import { systemSaid, systemSentencesEs } from "./system-sentences";

describe("sentences the backend writes into a record", () => {
  test("each is still written by the backend, word for word", async () => {
    const root = `${import.meta.dir}/../../convex`;
    let source = "";
    for await (const file of new Bun.Glob("*.ts").scan(root)) if (!file.includes(".test.")) source += await Bun.file(`${root}/${file}`).text();
    for (const sentence of Object.keys(systemSentencesEs)) expect(source.includes(`"${sentence}"`), sentence).toBe(true);
  });
  test("a Spanish reader sees them in Spanish; typed words and English readers are left alone", () => {
    expect(systemSaid("es", "Closed from the web requests.")).toBe("Cerrada desde las peticiones de la web.");
    expect(systemSaid("en", "Closed from the web requests.")).toBe("Closed from the web requests.");
    expect(systemSaid("es", "Llamó para dar las gracias.")).toBe("Llamó para dar las gracias.");
  });
});
