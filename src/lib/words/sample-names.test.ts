import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sampleNames, sampleSayer } from "./sample-names";

test("a Spanish reader of the sample meets the seed's names in Spanish; no one else's words are touched", () => {
  const es = sampleSayer(true, "es");
  expect(es("Help line morning")).toBe("Línea de ayuda por la mañana");
  expect(es("Home visit with Renee Baptiste")).toBe("Visita domiciliaria con Renee Baptiste");
  // A call's note is the request's line with a full stop; a caller's own words are not in the table.
  expect(es("Past-due water bill.")).toBe("Cuenta de agua vencida.");
  expect(es("Light bill is $145, and $60 is past due from last month.")).toBe("Light bill is $145, and $60 is past due from last month.");
  expect(es("Choir practice")).toBe("Choir practice");
  expect(sampleSayer(true, "en")("Pantry")).toBe("Pantry");
  expect(sampleSayer(false, "es")("Pantry")).toBe("Pantry");
});

test("every name in the table is one the seed still types, letter for letter", () => {
  const seed = readFileSync(new URL("../../../convex/sampleData.ts", import.meta.url), "utf8");
  for (const name of sampleNames) expect(seed).toContain(`"${name}"`);
});
