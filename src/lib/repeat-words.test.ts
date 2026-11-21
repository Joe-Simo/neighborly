import { describe, expect, test } from "bun:test";
import { repeatLines } from "./repeat-words";

describe("repeat lines", () => {
  test("Spanish says the records' fact plainly and marks the assistant's reading", () => {
    const at = Date.UTC(2026, 9, 30, 15);
    expect(repeatLines("es", "America/New_York", { recent: [{ at, kind: "rent", status: "paid", amount: 40000 }], same: [], differs: [{ at, what: "visit" }] })).toEqual([
      { text: "Se pagó ayuda de renta el 30 de octubre: $400.", assistant: false },
      { text: "El asistente lee que el informe de la visita del 30 de octubre dice otra cosa. Lee ambos antes de decidir.", assistant: true },
    ]);
  });
});
