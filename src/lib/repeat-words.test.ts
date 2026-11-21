import { describe, expect, test } from "bun:test";
import { paceLines, repeatLines } from "./repeat-words";

describe("repeat lines", () => {
  test("Spanish says the records' fact plainly and marks the assistant's reading", () => {
    const at = Date.UTC(2026, 9, 30, 15);
    expect(repeatLines("es", "America/New_York", { recent: [{ at, kind: "rent", status: "paid", amount: 40000 }], sameAmount: [], same: [], differs: [{ at, what: "visit" }] })).toEqual([
      { text: "Se pagó ayuda de renta el 30 de octubre: $400.", assistant: false },
      { text: "El asistente lee que el informe de la visita del 30 de octubre dice otra cosa. Lee ambos antes de decidir.", assistant: true },
    ]);
  });
});

describe("pace lines", () => {
  const base = { month: 11, thisMonth: 124000, lastYear: 98000, kind: "rent" as const, asked: 90000, approvals: 20, median: 35000, above: 19, baseline: 10 };
  test("this month against last year, and an amount above nine in ten", () => {
    expect(paceLines("en", base).map(line => line.text)).toEqual([
      "Approved so far in November: $1,240. November last year: $980.",
      "This amount is above 9 of every 10 rent approvals in the past year. The middle amount was $350.",
    ]);
  });
  test("an ordinary amount, or too few approvals to judge, says nothing about the amount", () => {
    expect(paceLines("es", { ...base, lastYear: 0, above: 12 }).map(line => line.text)).toEqual(["Aprobado hasta ahora en noviembre: $1,240. En noviembre del año pasado: nada."]);
    expect(paceLines("en", { ...base, thisMonth: 0, lastYear: 0, approvals: 9, above: 9 })).toEqual([]);
  });
});

test("a set budget is said in the month's line", () => {
  expect(paceLines("en", { month: 11, thisMonth: 124000, lastYear: 0, budget: 200000, kind: "food", asked: 0, approvals: 0, median: 0, above: 0, baseline: 10 })[0].text).toBe("Approved so far in November: $1,240 of the $2,000 monthly budget. November last year: none.");
});
