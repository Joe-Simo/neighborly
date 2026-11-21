import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sampleNames, sampleSayer } from "./sample-names";
import { sampleSentences } from "./sample-sentences";

test("a Spanish reader of the sample meets the seed's names in Spanish; no one else's words are touched", () => {
  const es = sampleSayer(true, "es");
  expect(es("Help line morning")).toBe("Línea de ayuda por la mañana");
  expect(es("Home visit with Thomas Okafor")).toBe("Visita domiciliaria con Thomas Okafor");
  // A call's note is the request's line with a full stop; a caller's own words are not in the table.
  expect(es("Past-due water bill.")).toBe("Recibo de agua vencido.");
  // The seed's own notes are said sentence by sentence; one unknown sentence keeps the whole note as typed.
  const notes = sampleSayer(true, "es", sampleSentences);
  expect(notes("Hard of hearing. Knock loudly and wait.")).toBe("Oye poco. Toca fuerte y espera.");
  expect(notes("Hard of hearing. Bring cookies.")).toBe("Hard of hearing. Bring cookies.");
  expect(notes("Past-due water bill.")).toBe("Recibo de agua vencido.");
  expect(es("Choir practice")).toBe("Choir practice");
  expect(sampleSayer(true, "en")("Pantry")).toBe("Pantry");
  expect(sampleSayer(false, "es")("Pantry")).toBe("Pantry");
  // The sample's owner, named by the backend, is said in Spanish too; a real member's name never is.
  expect(es("Sample Owner")).toBe("Responsable de la muestra");
  expect(sampleSayer(false, "es")("Sample Owner")).toBe("Sample Owner");
});

test("every name in the table is one the seed still types, letter for letter", () => {
  const seed = readFileSync(new URL("../../../convex/sampleData.ts", import.meta.url), "utf8");
  for (const name of sampleNames) expect(seed).toContain(`"${name}"`);
  for (const sentence of Object.keys(sampleSentences)) expect(seed).toContain(sentence);
});
