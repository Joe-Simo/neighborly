import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sampleNames, sampleSayer } from "./sample-names";

test("a Spanish reader of the sample meets the seed's names in Spanish; no one else's words are touched", () => {
  const es = sampleSayer(true, "es");
  expect(es("Help line morning")).toBe("Línea de ayuda, mañana");
  expect(es("Home visit with Renee Baptiste")).toBe("Visita domiciliaria con Renee Baptiste");
  expect(es("Choir practice")).toBe("Choir practice");
  expect(sampleSayer(true, "en")("Pantry")).toBe("Pantry");
  expect(sampleSayer(false, "es")("Pantry")).toBe("Pantry");
});

test("every name in the table is one the seed still types, letter for letter", () => {
  const seed = readFileSync(new URL("../../../convex/sampleData.ts", import.meta.url), "utf8");
  for (const name of sampleNames) expect(seed).toContain(`"${name}"`);
});
